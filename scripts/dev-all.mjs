import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = resolve(backendDir, '..');
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';
const colors = {
  api: '\x1b[36m',
  admin: '\x1b[35m',
  h5: '\x1b[32m',
  reset: '\x1b[0m',
};

const services = [
  {
    name: 'API',
    color: colors.api,
    cwd: backendDir,
    command: npm,
    args: ['run', 'start:dev'],
    port: 3008,
    url: 'http://localhost:3008',
    env: { PORT: '3008' },
  },
  {
    name: 'ADMIN',
    color: colors.admin,
    cwd: resolve(rootDir, 'admin'),
    command: npm,
    args: ['run', 'dev', '--', '--strictPort'],
    port: 5174,
    url: 'http://localhost:5174',
    env: { VITE_PROXY_TARGET: 'http://127.0.0.1:3008' },
  },
  {
    name: 'H5',
    color: colors.h5,
    cwd: resolve(rootDir, 'frontend'),
    command: pnpm,
    args: ['run', 'dev:h5'],
    port: 5173,
    url: 'http://localhost:5173',
    env: {
      VITE_PORT: '5173',
      VITE_PROXY_TARGET: 'http://127.0.0.1:3008',
      VITE_USE_MOCK_API: 'false',
      VITE_USE_WXCLOUD_CONTAINER: 'false',
    },
  },
];

function ensurePortAvailable(port) {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', (error) => reject(Object.assign(error, { port })));
    server.listen({ port, host: '127.0.0.1' }, () => server.close(resolvePort));
  });
}

function pipeLines(stream, service, write) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) write(`${service.color}[${service.name}]${colors.reset} ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (buffer.trim()) write(`${service.color}[${service.name}]${colors.reset} ${buffer}\n`);
  });
}

function terminate(child, signal = 'SIGTERM') {
  if (!child.pid || child.killed) return;
  try {
    if (isWindows) child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

async function waitUntilReachable(service, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await fetch(service.url, { signal: AbortSignal.timeout(1_000) });
      return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 300));
    }
  }
  throw new Error(`${service.name} 在 ${Math.round(timeoutMs / 1000)} 秒内未就绪`);
}

try {
  await Promise.all(services.map((service) => ensurePortAvailable(service.port)));
} catch (error) {
  const port = error?.port || '未知';
  console.error(`\n端口 ${port} 已被占用，请先关闭现有服务后重试。`);
  console.error(`可使用：lsof -nP -iTCP:${port} -sTCP:LISTEN\n`);
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) terminate(child);
  setTimeout(() => {
    for (const child of children) terminate(child, 'SIGKILL');
    process.exit(exitCode);
  }, 1_500).unref();
}

for (const service of services) {
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    env: { ...process.env, ...service.env, FORCE_COLOR: '1' },
    detached: !isWindows,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  pipeLines(child.stdout, service, process.stdout.write.bind(process.stdout));
  pipeLines(child.stderr, service, process.stderr.write.bind(process.stderr));
  child.once('error', (error) => {
    console.error(`[${service.name}] 启动失败：${error.message}`);
    shutdown(1);
  });
  child.once('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[${service.name}] 已退出（${signal || `code ${code}`}），正在停止其他服务。`);
    shutdown(code || 1);
  });
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));

Promise.all(services.map((service) => waitUntilReachable(service)))
  .then(() => {
    console.log('\n全部服务已就绪：');
    console.log('  前端 H5： http://localhost:5173');
    console.log('  管理系统： http://localhost:5174');
    console.log('  后端 API： http://localhost:3008');
    console.log('\n按 Ctrl+C 可一次停止全部服务。\n');
  })
  .catch((error) => {
    console.error(`\n启动检查失败：${error.message}`);
    shutdown(1);
  });
