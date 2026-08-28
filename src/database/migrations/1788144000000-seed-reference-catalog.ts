import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  REFERENCE_CATALOG_CATEGORIES,
  REFERENCE_CATALOG_MATERIALS,
} from '../../materials/reference-catalog';

export class SeedReferenceCatalog1788144000000 implements MigrationInterface {
  name = 'SeedReferenceCatalog1788144000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager.createQueryBuilder()
      .insert()
      .into('categories')
      .values(REFERENCE_CATALOG_CATEGORIES.map((category) => ({ ...category })))
      .orIgnore()
      .execute();

    await queryRunner.manager.createQueryBuilder()
      .insert()
      .into('materials')
      .values(REFERENCE_CATALOG_MATERIALS.map((material) => ({
        ...material,
        specs: material.specs.map((spec) => ({ ...spec })),
      })))
      .orIgnore()
      .execute();
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Catalog rows may already be referenced by carts, orders, and saved designs.
    // Keep them during a code rollback instead of deleting production data.
  }
}
