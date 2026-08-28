import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Material } from './entities/material.entity';
import { MaterialsService } from './materials.service';
import { AdminMaterialsController, MaterialsController } from './materials.controller';
import { MaterialAlias } from './entities/material-alias.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Material, MaterialAlias])],
  controllers: [MaterialsController, AdminMaterialsController],
  providers: [MaterialsService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
