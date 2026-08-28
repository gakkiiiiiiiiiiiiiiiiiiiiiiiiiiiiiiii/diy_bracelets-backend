const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, readdirSync, rmSync } = require('node:fs');
const net = require('node:net');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const sqlite3 = require('sqlite3');
const { hashAdminPassword } = require('../dist/auth/password-hash.js');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForReady(baseUrl, child, output) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`production server exited early (${child.exitCode})\n${output()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health/ready`);
      if (response.ok) return response;
    } catch {
      // The process may still be applying its first migration.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`production server did not become ready\n${output()}`);
}

function migrationNames(databasePath) {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(databasePath);
    database.all('select name from app_migrations order by id', (error, rows) => {
      database.close();
      if (error) reject(error);
      else resolve(rows.map((row) => row.name));
    });
  });
}

function seedUserSession(databasePath, userId) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const sessionId = randomBytes(16).toString('hex');
  const externalIdHash = createHash('sha256').update(`openid-${userId}`).digest('hex');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();

  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(databasePath);
    database.configure('busyTimeout', 5_000);
    database.serialize(() => {
      database.run(
        'insert into users (id, provider, externalIdHash, displayName, avatarUrl, lastLoginAt, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, 'wechat', externalIdHash, '', null, now, now, now],
      );
      database.run(
        'insert into auth_sessions (id, subjectType, subjectId, tokenHash, csrfHash, expiresAt, revokedAt, createdAt) values (?, ?, ?, ?, ?, ?, ?, ?)',
        [sessionId, 'user', userId, tokenHash, null, expiresAt, null, now],
        (error) => {
          database.close();
          if (error) reject(error);
          else resolve(token);
        },
      );
    });
  });
}

test('production server migrates an empty database and enforces HTTP safeguards', async () => {
  const runtimeDir = mkdtempSync(join(tmpdir(), 'diy-bracelets-production-'));
  const databasePath = join(runtimeDir, 'app.sqlite');
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const adminPassword = 'production-smoke-password';
  let logs = '';
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      DB_HOST: '',
      REMOTE_DB_HOST: '',
      DATABASE_PATH: databasePath,
      ALLOW_SQLITE_PRODUCTION: 'true',
      UPLOAD_DIR: join(runtimeDir, 'uploads'),
      CORS_ORIGINS: 'https://app.example.com',
      CORS_ALLOW_CREDENTIALS: 'true',
      ADMIN_USERNAME: 'production-admin',
      ADMIN_PASSWORD_HASH: hashAdminPassword(adminPassword),
      ADMIN_COOKIE_SECURE: 'true',
      WECHAT_APP_ID: 'wx1234567890abcdef',
      WECHAT_APP_SECRET: '1234567890abcdef1234567890abcdef',
      UPLOAD_STORAGE_MODE: 'persistent',
      TRUST_PROXY: 'false',
      RATE_LIMIT_MAX: '100',
      DB_CONNECT_RETRIES: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const append = (chunk) => {
    logs = `${logs}${String(chunk)}`.slice(-20_000);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);

  try {
    const ready = await waitForReady(baseUrl, child, () => logs);
    const readyBody = await ready.json();
    assert.equal(readyBody.status, 'ok');
    assert.equal(readyBody.info.database.status, 'up');
    assert.equal(readyBody.info.storage.status, 'up');

    const allowed = await fetch(`${baseUrl}/health/live`, {
      headers: { Origin: 'https://app.example.com' },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.example.com');
    assert.ok(allowed.headers.get('x-request-id'));
    assert.equal(allowed.headers.get('x-content-type-options'), 'nosniff');

    const denied = await fetch(`${baseUrl}/health/live`, {
      headers: { Origin: 'https://evil.example.com' },
    });
    assert.equal(denied.status, 403);

    const renderPreflight = await fetch(`${baseUrl}/api/design-process-videos/11111111-1111-4111-8111-111111111111/render`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.example.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'x-video-render-token',
      },
    });
    assert.equal(renderPreflight.status, 204);
    assert.match(renderPreflight.headers.get('access-control-allow-headers'), /X-Video-Render-Token/i);

    const unauthenticatedMutation = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'invalid', name: 'Invalid', unexpected: true }),
    });
    assert.equal(unauthenticatedMutation.status, 401);

    const login = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'production-admin', password: adminPassword }),
    });
    assert.equal(login.status, 200);
    const loginBody = await login.json();
    assert.ok(loginBody.csrfToken);
    assert.equal('token' in loginBody, false);
    const adminCookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(adminCookie, /^__Host-diy_admin_session=/);

    const agentProvider = await fetch(`${baseUrl}/api/admin/agent/provider`, {
      headers: { cookie: adminCookie },
    });
    assert.equal(agentProvider.status, 200);
    assert.equal((await agentProvider.json()).ready, false);

    const extractionProvider = await fetch(`${baseUrl}/api/admin/extraction-provider`, {
      headers: { cookie: adminCookie },
    });
    assert.equal(extractionProvider.status, 200);
    assert.equal((await extractionProvider.json()).ready, false);

    const disabledAgentTask = await fetch(`${baseUrl}/api/admin/agent/generations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: adminCookie,
        'x-csrf-token': loginBody.csrfToken,
      },
      body: JSON.stringify({ colors: ['#ffffff'], wristCm: 16 }),
    });
    assert.equal(disabledAgentTask.status, 503);

    const disabledExtractionTask = await fetch(`${baseUrl}/api/admin/extraction-jobs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: adminCookie,
        'x-csrf-token': loginBody.csrfToken,
      },
      body: JSON.stringify({ sourceRefs: ['/uploads/not-used.png'] }),
    });
    assert.equal(disabledExtractionTask.status, 503);

    const missingCsrf = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ id: 'csrf', name: 'CSRF' }),
    });
    assert.equal(missingCsrf.status, 403);

    const fakeImageForm = new FormData();
    fakeImageForm.append('file', new Blob(['<html>not an image</html>'], { type: 'image/png' }), 'fake.png');
    const rejectedFakeImage = await fetch(`${baseUrl}/api/admin/materials/upload`, {
      method: 'POST',
      headers: { cookie: adminCookie, 'x-csrf-token': loginBody.csrfToken },
      body: fakeImageForm,
    });
    assert.equal(rejectedFakeImage.status, 400);
    assert.equal(readdirSync(join(runtimeDir, 'uploads')).filter((name) => name.endsWith('.png')).length, 0);

    const fakeExtractionForm = new FormData();
    fakeExtractionForm.append('files', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
    const rejectedFakeExtraction = await fetch(`${baseUrl}/api/admin/extraction-images`, {
      method: 'POST',
      headers: { cookie: adminCookie, 'x-csrf-token': loginBody.csrfToken },
      body: fakeExtractionForm,
    });
    assert.equal(rejectedFakeExtraction.status, 400);

    const validImageForm = new FormData();
    validImageForm.append('file', new Blob([Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )], { type: 'image/png' }), 'valid.png');
    const uploadedImage = await fetch(`${baseUrl}/api/admin/materials/upload`, {
      method: 'POST',
      headers: { cookie: adminCookie, 'x-csrf-token': loginBody.csrfToken },
      body: validImageForm,
    });
    assert.equal(uploadedImage.status, 201);
    const uploadedImageBody = await uploadedImage.json();
    assert.match(uploadedImageBody.path, /^\/uploads\/[0-9]+-[0-9a-f-]+\.png$/);
    assert.equal((await fetch(`${baseUrl}${uploadedImageBody.path}`)).status, 200);

    const invalidOrderFilter = await fetch(`${baseUrl}/api/admin/orders?status=not-a-status`, {
      headers: { cookie: adminCookie },
    });
    assert.equal(invalidOrderFilter.status, 400);

    const invalidBody = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: adminCookie,
        'x-csrf-token': loginBody.csrfToken,
      },
      body: JSON.stringify({ id: 'invalid', name: 'Invalid', unexpected: true }),
    });
    assert.equal(invalidBody.status, 400);

    const createdCategory = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: adminCookie,
        'x-csrf-token': loginBody.csrfToken,
      },
      body: JSON.stringify({ id: 'secure-category', name: 'Secure Category' }),
    });
    assert.equal(createdCategory.status, 201);

    const publicContent = await fetch(`${baseUrl}/api/content/home`);
    assert.equal(publicContent.status, 200);
    const publicContentBody = await publicContent.json();
    assert.equal('draftContent' in publicContentBody, false);

    const publicMaterials = await fetch(`${baseUrl}/api/materials`);
    assert.equal(publicMaterials.status, 200);
    const referenceMaterial = (await publicMaterials.json()).find((row) => row.id === 'source-clear-quartz');
    assert.equal(referenceMaterial.specs[0].specId, 'source-clear-quartz-6mm-0');
    assert.equal(referenceMaterial.specs[0].price, 3);

    const firstUserToken = await seedUserSession(databasePath, '11111111-1111-4111-8111-111111111111');
    const secondUserToken = await seedUserSession(databasePath, '22222222-2222-4222-8222-222222222222');

    const initialProfile = await fetch(`${baseUrl}/api/profile`, {
      headers: { authorization: `Bearer ${firstUserToken}` },
    });
    assert.equal(initialProfile.status, 200);
    assert.equal((await initialProfile.json()).name, '珠岛用户');

    const updatedProfile = await fetch(`${baseUrl}/api/profile`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${firstUserToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ displayName: '月岛用户' }),
    });
    assert.equal(updatedProfile.status, 200);
    assert.equal((await updatedProfile.json()).name, '月岛用户');

    const secondProfile = await fetch(`${baseUrl}/api/profile`, {
      headers: { authorization: `Bearer ${secondUserToken}` },
    });
    assert.equal(secondProfile.status, 200);
    assert.equal((await secondProfile.json()).name, '珠岛用户');

    const customCatalogCart = await fetch(`${baseUrl}/api/cart`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${firstUserToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        items: [{
          clientItemId: 'custom-reference-catalog-smoke',
          kind: 'custom',
          name: '客户端名称不参与计价',
          qty: 1,
          composition: [{
            materialId: 'source-clear-quartz',
            specId: 'source-clear-quartz-6mm-0',
            size: 99,
            quantity: 2,
          }],
        }],
      }),
    });
    assert.equal(customCatalogCart.status, 200);
    const canonicalCustomItem = (await customCatalogCart.json()).items[0];
    assert.equal(canonicalCustomItem.price, 6);
    assert.equal(canonicalCustomItem.composition[0].size, 6);
    assert.equal(canonicalCustomItem.composition[0].price, 3);

    const disabledVideoJob = await fetch(`${baseUrl}/api/design-process-videos`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${firstUserToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        steps: [{
          id: 'add-1',
          action: 'add',
          at: 1,
          beads: [{
            materialId: 'source-clear-quartz',
            specId: 'source-clear-quartz-6mm-0',
            name: '净体白水晶',
            image: '/static/materials/reference-crystals/clear-quartz/clear-quartz-preview.png',
            size: 6,
            price: 3,
            orderIndex: 0,
          }],
        }],
        wristCm: 16,
      }),
    });
    assert.equal(disabledVideoJob.status, 503);

    const createdDesign = await fetch(`${baseUrl}/api/my-designs`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${firstUserToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: 'Private design', composition: [] }),
    });
    assert.equal(createdDesign.status, 201);
    const createdDesignBody = await createdDesign.json();

    const ownerList = await fetch(`${baseUrl}/api/my-designs`, {
      headers: { authorization: `Bearer ${firstUserToken}` },
    });
    assert.equal(ownerList.status, 200);
    assert.equal((await ownerList.json()).length, 1);

    const otherList = await fetch(`${baseUrl}/api/my-designs`, {
      headers: { authorization: `Bearer ${secondUserToken}` },
    });
    assert.equal(otherList.status, 200);
    assert.deepEqual(await otherList.json(), []);

    const crossUserRead = await fetch(`${baseUrl}/api/my-designs/${createdDesignBody.id}`, {
      headers: { authorization: `Bearer ${secondUserToken}` },
    });
    assert.equal(crossUserRead.status, 404);

    const createdAddress = await fetch(`${baseUrl}/api/addresses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${firstUserToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: '测试用户',
        phone: '13800138000',
        region: '上海市 浦东新区',
        detail: '测试路 1 号',
        isDefault: true,
      }),
    });
    assert.equal(createdAddress.status, 201);
    const address = await createdAddress.json();

    const methodOverrideUpdate = await fetch(`${baseUrl}/api/addresses/${address.id}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${firstUserToken}`,
        'content-type': 'application/json',
        'x-http-method-override': 'PATCH',
      },
      body: JSON.stringify({ detail: '测试路 2 号' }),
    });
    assert.equal(methodOverrideUpdate.status, 200);
    assert.equal((await methodOverrideUpdate.json()).detail, '测试路 2 号');

    const cartItem = {
      clientItemId: 'cart-product-shop-white-bubble-bracelet-12mm',
      kind: 'product',
      productId: 'shop-white-bubble-bracelet',
      spec: '12mm',
      qty: 2,
      price: 0.01,
    };
    const replacedCart = await fetch(`${baseUrl}/api/cart`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${firstUserToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ items: [cartItem] }),
    });
    assert.equal(replacedCart.status, 400, 'unknown client price fields are rejected');
    delete cartItem.price;

    const oversizedCart = await fetch(`${baseUrl}/api/cart`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${firstUserToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ items: [{ ...cartItem, qty: 100 }] }),
    });
    assert.equal(oversizedCart.status, 400, 'retail quantities are capped per line item');

    const validCart = await fetch(`${baseUrl}/api/cart`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${firstUserToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ items: [cartItem] }),
    });
    assert.equal(validCart.status, 200);
    assert.equal((await validCart.json()).items[0].price, 280);

    const orderPayload = {
      addressId: address.id,
      idempotencyKey: 'smoke-order-key-0001',
      items: [cartItem],
      cartItemIds: [cartItem.clientItemId],
      note: '服务端重新计价',
    };
    const createdOrder = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${firstUserToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });
    assert.equal(createdOrder.status, 201);
    const order = await createdOrder.json();
    assert.equal(order.total, 560);
    assert.equal(order.statusCode, 'pending_confirmation');

    const retriedOrder = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${firstUserToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });
    assert.equal(retriedOrder.status, 201);
    assert.equal((await retriedOrder.json()).id, order.id);

    const emptiedCart = await fetch(`${baseUrl}/api/cart`, {
      headers: { authorization: `Bearer ${firstUserToken}` },
    });
    assert.equal(emptiedCart.status, 200);
    assert.deepEqual((await emptiedCart.json()).items, []);

    const otherUserOrder = await fetch(`${baseUrl}/api/orders/${order.id}`, {
      headers: { authorization: `Bearer ${secondUserToken}` },
    });
    assert.equal(otherUserOrder.status, 404);

    for (const statusBody of [
      { status: 'confirmed' },
      { status: 'producing' },
      { status: 'shipped', trackingCarrier: '顺丰速运', trackingNo: 'SF1234567890' },
    ]) {
      const transitioned = await fetch(`${baseUrl}/api/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie: adminCookie,
          'x-csrf-token': loginBody.csrfToken,
        },
        body: JSON.stringify(statusBody),
      });
      assert.equal(transitioned.status, 200);
    }

    const confirmedReceipt = await fetch(`${baseUrl}/api/orders/${order.id}/confirm-receipt`, {
      method: 'POST',
      headers: { authorization: `Bearer ${firstUserToken}` },
    });
    assert.equal(confirmedReceipt.status, 201);
    assert.equal((await confirmedReceipt.json()).statusCode, 'delivered');

    const requestedAfterSale = await fetch(`${baseUrl}/api/orders/${order.id}/after-sale`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${firstUserToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ note: '需要调整手围尺寸' }),
    });
    assert.equal(requestedAfterSale.status, 201);
    assert.equal((await requestedAfterSale.json()).statusCode, 'after_sale');

    const resolvedAfterSale = await fetch(`${baseUrl}/api/admin/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: adminCookie,
        'x-csrf-token': loginBody.csrfToken,
      },
      body: JSON.stringify({ status: 'delivered' }),
    });
    assert.equal(resolvedAfterSale.status, 200);
    assert.equal((await resolvedAfterSale.json()).statusCode, 'delivered');

    assert.deepEqual(
      await migrationNames(databasePath),
      [
        'InitialSchema1787884800000',
        'AuthAndOwnership1787971200000',
        'Commerce1788057600000',
        'SeedReferenceCatalog1788144000000',
        'VideoRenderToken1788230400000',
      ],
    );
  } finally {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
    rmSync(runtimeDir, { recursive: true, force: true });
  }
});
