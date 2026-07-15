import { Module } from '@nestjs/common';
import { MaterialsModule } from '../materials/materials.module';
import { BraceletCodeController } from './bracelet-code.controller';
import { BraceletCodeService } from './bracelet-code.service';

@Module({ imports: [MaterialsModule], controllers: [BraceletCodeController], providers: [BraceletCodeService], exports: [BraceletCodeService] })
export class BraceletCodeModule {}
