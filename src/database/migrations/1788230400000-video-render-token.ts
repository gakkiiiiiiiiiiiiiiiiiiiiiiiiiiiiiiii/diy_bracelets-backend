import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class VideoRenderToken1788230400000 implements MigrationInterface {
  name = 'VideoRenderToken1788230400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasTable('design_process_videos')) return;
    const table = await queryRunner.getTable('design_process_videos');
    if (!table?.findColumnByName('renderTokenHash')) {
      await queryRunner.addColumn('design_process_videos', new TableColumn({
        name: 'renderTokenHash',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }));
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasTable('design_process_videos')) return;
    const table = await queryRunner.getTable('design_process_videos');
    if (table?.findColumnByName('renderTokenHash')) {
      await queryRunner.dropColumn('design_process_videos', 'renderTokenHash');
    }
  }
}
