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

export class InitialSchema1787884800000 implements MigrationInterface {
  name = 'InitialSchema1787884800000';

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
    const createdAt = (): Column => ({
      name: 'createdAt',
      type: dateType,
      default: 'CURRENT_TIMESTAMP',
    });
    const updatedAt = (): Column => ({
      name: 'updatedAt',
      type: dateType,
      default: 'CURRENT_TIMESTAMP',
    });
    const varchar = (name: string, options: Partial<Column> = {}): Column => ({
      name,
      type: 'varchar',
      length: '255',
      ...options,
    });
    const text = (name: string, options: Partial<Column> = {}): Column => ({
      name,
      type: 'text',
      ...options,
    });
    const json = (name: string, options: Partial<Column> = {}): Column => ({
      name,
      type: jsonType,
      ...options,
    });
    const integer = (name: string, options: Partial<Column> = {}): Column => ({
      name,
      type: 'int',
      ...options,
    });
    const create = async (
      name: string,
      columns: Column[],
      indices: TableIndexOptions[] = [],
    ): Promise<void> => {
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

    await create('categories', [
      varchar('id', { isPrimary: true }),
      varchar('name'),
      createdAt(),
      updatedAt(),
    ]);

    await create('materials', [
      varchar('id', { isPrimary: true }),
      varchar('name'),
      varchar('image', { default: "''" }),
      varchar('categoryId'),
      json('specs'),
      varchar('status', { length: '20', default: "'published'" }),
      { name: 'isAvailable', type: 'boolean', default: 'true' },
      varchar('crystalFamily', { default: "''" }),
      json('aliases', { isNullable: true }),
      json('dominantColors', { isNullable: true }),
      varchar('transparency', { default: "''" }),
      varchar('pattern', { default: "''" }),
      varchar('inclusions', { default: "''" }),
      json('sourceRefs', { isNullable: true }),
      json('confidence', { isNullable: true }),
      varchar('generatedBy', { length: '20', default: "'manual'" }),
      json('manualOverrides', { isNullable: true }),
      json('embedding', { isNullable: true }),
      json('assetBundle', { isNullable: true }),
      createdAt(),
      updatedAt(),
    ], [
      { name: 'IDX_materials_category', columnNames: ['categoryId'] },
      { name: 'IDX_materials_status', columnNames: ['status', 'isAvailable'] },
    ]);

    await create('material_aliases', [
      varchar('fromId', { isPrimary: true }),
      varchar('toId'),
      createdAt(),
    ], [
      { name: 'IDX_material_aliases_to', columnNames: ['toId'] },
    ]);

    await create('designs', [
      uuid(),
      varchar('source', { length: '20', default: "'designer'" }),
      varchar('title'),
      varchar('author', { default: "''" }),
      varchar('image', { default: "''" }),
      json('images', { isNullable: true }),
      integer('usageCount', { default: '0' }),
      json('composition'),
      json('orderedBeads', { isNullable: true }),
      { name: 'wristCm', type: 'float', isNullable: true },
      text('braceletCode', { isNullable: true }),
      { name: 'isInspiration', type: 'boolean', default: 'true' },
      varchar('reviewStatus', { length: '20', default: "'approved'" }),
      text('reviewNote', { isNullable: true }),
      varchar('reviewedAt', { length: '32', isNullable: true }),
      createdAt(),
      updatedAt(),
    ], [
      { name: 'IDX_designs_source_review', columnNames: ['source', 'reviewStatus'] },
      { name: 'IDX_designs_inspiration_review', columnNames: ['isInspiration', 'reviewStatus'] },
      { name: 'IDX_designs_created', columnNames: ['createdAt'] },
    ]);
    const designs = await queryRunner.getTable('designs');
    const reviewedAt = designs?.findColumnByName('reviewedAt');
    if (reviewedAt && reviewedAt.type !== 'varchar') {
      await queryRunner.changeColumn(
        'designs',
        reviewedAt,
        new TableColumn({
          name: 'reviewedAt',
          type: 'varchar',
          length: '32',
          isNullable: true,
        }),
      );
    }

    await create('saved_designs', [
      uuid(),
      varchar('title'),
      json('composition'),
      createdAt(),
      updatedAt(),
    ], [
      { name: 'IDX_saved_designs_created', columnNames: ['createdAt'] },
    ]);

    await create('page_configs', [
      varchar('key', { length: '64', isPrimary: true }),
      varchar('name', { length: '100' }),
      json('draftContent'),
      json('publishedContent', { isNullable: true }),
      { name: 'isPublished', type: 'boolean', default: 'false' },
      { name: 'hasUnpublishedChanges', type: 'boolean', default: 'false' },
      varchar('publishedAt', { length: '32', isNullable: true }),
      createdAt(),
      updatedAt(),
    ]);

    await create('extraction_jobs', [
      uuid(),
      varchar('status', { length: '40', default: "'queued'" }),
      json('sourceRefs'),
      integer('currentIndex', { default: '0' }),
      integer('totalSources', { default: '0' }),
      integer('processedCandidates', { default: '0' }),
      integer('publishedCount', { default: '0' }),
      integer('duplicateCount', { default: '0' }),
      integer('failedCount', { default: '0' }),
      text('error', { isNullable: true }),
      createdAt(),
      updatedAt(),
    ], [
      { name: 'IDX_extraction_jobs_status', columnNames: ['status', 'createdAt'] },
    ]);

    await create('extraction_results', [
      uuid(),
      varchar('jobId'),
      varchar('sourceRef'),
      integer('candidateIndex', { default: '0' }),
      varchar('status', { length: '20', default: "'detected'" }),
      json('detection'),
      varchar('sourceHash', { default: "''" }),
      varchar('sourceCrop', { default: "''" }),
      varchar('perceptualHash', { default: "''" }),
      json('embedding', { isNullable: true }),
      text('prompt', { default: "''" }),
      varchar('keyColor', { length: '10', default: "'green'" }),
      varchar('keyImage', { default: "''" }),
      varchar('image', { default: "''" }),
      varchar('materialId', { isNullable: true }),
      varchar('duplicateOf', { isNullable: true }),
      text('error', { isNullable: true }),
      integer('attempts', { default: '0' }),
      createdAt(),
      updatedAt(),
    ], [
      { name: 'IDX_extraction_results_job', columnNames: ['jobId', 'status'] },
      { name: 'IDX_extraction_results_hash', columnNames: ['sourceHash'] },
    ]);

    await create('agent_generations', [
      uuid(),
      varchar('status', { length: '20', default: "'queued'" }),
      json('input'),
      json('candidates', { isNullable: true }),
      text('referenceDescription', { isNullable: true }),
      text('error', { isNullable: true }),
      createdAt(),
      updatedAt(),
    ], [
      { name: 'IDX_agent_generations_status', columnNames: ['status', 'createdAt'] },
    ]);

    await create('agent_feedback', [
      uuid(),
      varchar('generationId'),
      varchar('action', { length: '20' }),
      integer('candidateIndex', { isNullable: true }),
      json('finalBeads', { isNullable: true }),
      text('note', { default: "''" }),
      createdAt(),
    ], [
      { name: 'IDX_agent_feedback_generation', columnNames: ['generationId'] },
    ]);

    await create('design_process_videos', [
      uuid(),
      varchar('status', { length: '20', default: "'queued'" }),
      integer('progress', { default: '0' }),
      json('steps'),
      json('palette', { isNullable: true }),
      { name: 'wristCm', type: 'float', default: '16' },
      text('videoUrl', { isNullable: true }),
      integer('durationMs', { isNullable: true }),
      integer('width', { default: '720' }),
      integer('height', { default: '1280' }),
      text('error', { isNullable: true }),
      createdAt(),
      updatedAt(),
    ], [
      { name: 'IDX_design_process_videos_status', columnNames: ['status', 'createdAt'] },
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'design_process_videos',
      'agent_feedback',
      'agent_generations',
      'extraction_results',
      'extraction_jobs',
      'page_configs',
      'saved_designs',
      'designs',
      'material_aliases',
      'materials',
      'categories',
    ]) {
      if (await queryRunner.hasTable(table)) await queryRunner.dropTable(table, true);
    }
  }
}
