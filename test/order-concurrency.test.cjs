const test = require('node:test');
const assert = require('node:assert/strict');
const { ConflictException } = require('@nestjs/common');
const { OrdersService } = require('../dist/orders/orders.service.js');

function order(status = 'producing') {
  return {
    id: 'order-1',
    orderNo: 'ZD20260828AABBCC',
    userId: 'user-1',
    status,
    items: [],
    itemTotalCents: 1000,
    freightCents: 0,
    discountCents: 0,
    totalCents: 1000,
    itemCount: 1,
    addressSnapshot: {},
    note: '',
    trackingCarrier: null,
    trackingNo: null,
    remindedAt: null,
    afterSaleNote: null,
    createdAt: new Date('2026-08-28T00:00:00Z'),
    updatedAt: new Date('2026-08-28T00:00:00Z'),
  };
}

test('admin status updates compare the previously read status before writing', async () => {
  const current = order('producing');
  let criteria;
  let changes;
  const repository = {
    findOne: async () => current,
    update: async (nextCriteria, nextChanges) => {
      criteria = nextCriteria;
      changes = nextChanges;
      return { affected: 1 };
    },
  };
  const service = new OrdersService(repository, {}, {}, {});
  await service.updateStatus(current.id, {
    status: 'shipped',
    trackingCarrier: '顺丰速运',
    trackingNo: 'SF123456',
  });
  assert.deepEqual(criteria, { id: current.id, status: 'producing' });
  assert.deepEqual(changes, {
    status: 'shipped',
    trackingCarrier: '顺丰速运',
    trackingNo: 'SF123456',
  });
});

test('a stale concurrent order transition is rejected instead of overwriting the winner', async () => {
  const current = order('shipped');
  const repository = {
    findOne: async () => current,
    update: async () => ({ affected: 0 }),
  };
  const service = new OrdersService(repository, {}, {}, {});
  await assert.rejects(
    () => service.confirmReceipt('user-1', current.id),
    (error) => error instanceof ConflictException && error.message.includes('状态已变化'),
  );
});
