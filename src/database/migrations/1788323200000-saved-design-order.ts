import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class SavedDesignOrder1788323200000 implements MigrationInterface {
  name = 'SavedDesignOrder1788323200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasTable('saved_designs')) return;
    const table = await queryRunner.getTable('saved_designs');
    if (!table?.findColumnByName('orderedBeads')) {
      await queryRunner.addColumn('saved_designs', new TableColumn({
        name: 'orderedBeads',
        type: 'text',
        isNullable: true,
      }));
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasTable('saved_designs')) return;
    const table = await queryRunner.getTable('saved_designs');
    if (table?.findColumnByName('orderedBeads')) {
      await queryRunner.dropColumn('saved_designs', 'orderedBeads');
    }
  }
}
