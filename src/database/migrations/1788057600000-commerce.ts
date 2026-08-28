import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumnOptions,
  TableIndex,
  TableIndexOptions,
} from 'typeorm';

type Column = TableColumnOptions;

export class Commerce1788057600000 implements MigrationInterface {
  name = 'Commerce1788057600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;
    const uuidType = driver === 'postgres' ? 'uuid' : 'varchar';
    const dateType = driver === 'postgres' ? 'timestamp with time zone' : 'datetime';
    const jsonType = driver === 'mysql' || driver === 'mariadb' ? 'longtext' : 'text';
    const uuid = (): Column => ({
      name: 'id',
      type: uuidType,
      length: driver === 'postgres' ? undefined : '36',
      isPrimary: true,
      isGenerated: true,
      generationStrategy: 'uuid',
    });
    const createdAt = (): Column => ({ name: 'createdAt', type: dateType, default: 'CURRENT_TIMESTAMP' });
    const updatedAt = (): Column => ({ name: 'updatedAt', type: dateType, default: 'CURRENT_TIMESTAMP' });
    const create = async (name: string, columns: Column[], indices: TableIndexOptions[]) => {
      if (!await queryRunner.hasTable(name)) {
        await queryRunner.createTable(new Table({ name, columns }), true);
      }
      const table = await queryRunner.getTable(name);
      for (const index of indices) {
        if (!table?.indices.some((existing) => existing.name === index.name)) {
          await queryRunner.createIndex(name, new TableIndex(index));
        }
      }
    };

    await create('cart_items', [
      uuid(),
      { name: 'userId', type: 'varchar', length: '36' },
      { name: 'clientItemId', type: 'varchar', length: '120' },
      { name: 'kind', type: 'varchar', length: '20' },
      { name: 'productId', type: 'varchar', length: '100', isNullable: true },
      { name: 'name', type: 'varchar', length: '120' },
      { name: 'image', type: 'text', default: "''" },
      { name: 'spec', type: 'varchar', length: '80', default: "''" },
      { name: 'unitPriceCents', type: 'int' },
      { name: 'quantity', type: 'int' },
      { name: 'handCircumferenceCm', type: 'float', isNullable: true },
      { name: 'estimatedCircumferenceCm', type: 'float', isNullable: true },
      { name: 'composition', type: jsonType, isNullable: true },
      createdAt(),
      updatedAt(),
    ], [
      { name: 'UQ_cart_items_user_client', columnNames: ['userId', 'clientItemId'], isUnique: true },
      { name: 'IDX_cart_items_user_updated', columnNames: ['userId', 'updatedAt'] },
    ]);

    await create('user_addresses', [
      uuid(),
      { name: 'userId', type: 'varchar', length: '36' },
      { name: 'name', type: 'varchar', length: '60' },
      { name: 'phone', type: 'varchar', length: '20' },
      { name: 'region', type: 'varchar', length: '120' },
      { name: 'detail', type: 'varchar', length: '240' },
      { name: 'isDefault', type: 'boolean', default: 'false' },
      createdAt(),
      updatedAt(),
    ], [
      { name: 'IDX_user_addresses_user_default', columnNames: ['userId', 'isDefault'] },
    ]);

    await create('orders', [
      uuid(),
      { name: 'orderNo', type: 'varchar', length: '32' },
      { name: 'userId', type: 'varchar', length: '36' },
      { name: 'status', type: 'varchar', length: '30', default: "'pending_confirmation'" },
      { name: 'idempotencyKey', type: 'varchar', length: '64' },
      { name: 'itemTotalCents', type: 'int' },
      { name: 'freightCents', type: 'int', default: '0' },
      { name: 'discountCents', type: 'int', default: '0' },
      { name: 'totalCents', type: 'int' },
      { name: 'itemCount', type: 'int' },
      { name: 'addressSnapshot', type: jsonType },
      { name: 'items', type: jsonType },
      { name: 'note', type: 'text', default: "''" },
      { name: 'trackingCarrier', type: 'varchar', length: '80', isNullable: true },
      { name: 'trackingNo', type: 'varchar', length: '100', isNullable: true },
      { name: 'remindedAt', type: 'varchar', length: '32', isNullable: true },
      { name: 'afterSaleNote', type: 'text', isNullable: true },
      createdAt(),
      updatedAt(),
    ], [
      { name: 'UQ_orders_order_no', columnNames: ['orderNo'], isUnique: true },
      { name: 'UQ_orders_user_idempotency', columnNames: ['userId', 'idempotencyKey'], isUnique: true },
      { name: 'IDX_orders_user_created', columnNames: ['userId', 'createdAt'] },
      { name: 'IDX_orders_status_created', columnNames: ['status', 'createdAt'] },
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('orders')) await queryRunner.dropTable('orders', true);
    if (await queryRunner.hasTable('user_addresses')) await queryRunner.dropTable('user_addresses', true);
    if (await queryRunner.hasTable('cart_items')) await queryRunner.dropTable('cart_items', true);
  }
}
