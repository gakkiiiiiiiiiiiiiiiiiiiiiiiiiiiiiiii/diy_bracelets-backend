import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableColumnOptions,
  TableIndex,
  TableIndexOptions,
} from 'typeorm';

type Column = TableColumnOptions;

export class AuthAndOwnership1787971200000 implements MigrationInterface {
  name = 'AuthAndOwnership1787971200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;
    const uuidType = driver === 'postgres' ? 'uuid' : 'varchar';
    const dateType = driver === 'postgres' ? 'timestamp with time zone' : 'datetime';
    const uuid = (): Column => ({
      name: 'id',
      type: uuidType,
      length: driver === 'postgres' ? undefined : '36',
      isPrimary: true,
      isGenerated: true,
      generationStrategy: 'uuid',
    });
    const create = async (
      name: string,
      columns: Column[],
      indices: TableIndexOptions[],
    ) => {
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

    await create('users', [
      uuid(),
      { name: 'provider', type: 'varchar', length: '20' },
      { name: 'externalIdHash', type: 'varchar', length: '64' },
      { name: 'displayName', type: 'varchar', length: '80', default: "''" },
      { name: 'avatarUrl', type: 'text', isNullable: true },
      { name: 'lastLoginAt', type: 'varchar', length: '32' },
      { name: 'createdAt', type: dateType, default: 'CURRENT_TIMESTAMP' },
      { name: 'updatedAt', type: dateType, default: 'CURRENT_TIMESTAMP' },
    ], [
      {
        name: 'UQ_users_provider_subject',
        columnNames: ['provider', 'externalIdHash'],
        isUnique: true,
      },
    ]);

    await create('auth_sessions', [
      uuid(),
      { name: 'subjectType', type: 'varchar', length: '10' },
      { name: 'subjectId', type: 'varchar', length: '64' },
      { name: 'tokenHash', type: 'varchar', length: '64' },
      { name: 'csrfHash', type: 'varchar', length: '64', isNullable: true },
      { name: 'expiresAt', type: 'varchar', length: '32' },
      { name: 'revokedAt', type: 'varchar', length: '32', isNullable: true },
      { name: 'createdAt', type: dateType, default: 'CURRENT_TIMESTAMP' },
    ], [
      { name: 'UQ_auth_sessions_token_hash', columnNames: ['tokenHash'], isUnique: true },
      {
        name: 'IDX_auth_sessions_subject',
        columnNames: ['subjectType', 'subjectId', 'expiresAt'],
      },
    ]);

    await this.addOwnershipColumn(queryRunner, 'saved_designs', 'userId', 'IDX_saved_designs_user');
    await this.addOwnershipColumn(queryRunner, 'designs', 'ownerId', 'IDX_designs_owner');
    await this.addOwnershipColumn(
      queryRunner,
      'design_process_videos',
      'ownerId',
      'IDX_design_process_videos_owner',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropOwnershipColumn(queryRunner, 'design_process_videos', 'ownerId');
    await this.dropOwnershipColumn(queryRunner, 'designs', 'ownerId');
    await this.dropOwnershipColumn(queryRunner, 'saved_designs', 'userId');
    if (await queryRunner.hasTable('auth_sessions')) {
      await queryRunner.dropTable('auth_sessions', true);
    }
    if (await queryRunner.hasTable('users')) {
      await queryRunner.dropTable('users', true);
    }
  }

  private async addOwnershipColumn(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
    indexName: string,
  ): Promise<void> {
    if (!await queryRunner.hasTable(tableName)) return;
    let table = await queryRunner.getTable(tableName);
    if (!table?.findColumnByName(columnName)) {
      await queryRunner.addColumn(tableName, new TableColumn({
        name: columnName,
        type: 'varchar',
        length: '36',
        isNullable: true,
      }));
      table = await queryRunner.getTable(tableName);
    }
    if (!table?.indices.some((index) => index.name === indexName)) {
      await queryRunner.createIndex(
        tableName,
        new TableIndex({ name: indexName, columnNames: [columnName] }),
      );
    }
  }

  private async dropOwnershipColumn(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    if (!await queryRunner.hasTable(tableName)) return;
    const table = await queryRunner.getTable(tableName);
    if (table?.findColumnByName(columnName)) {
      await queryRunner.dropColumn(tableName, columnName);
    }
  }
}
