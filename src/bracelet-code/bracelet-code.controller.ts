import { Body, Controller, Post } from '@nestjs/common';
import { BraceletCodeService } from './bracelet-code.service';
import { EncodeBraceletCodeDto, ResolveBraceletCodeDto } from './dto/bracelet-code.dto';
import { Access } from '../auth/access.decorator';

@Access('public')
@Controller('api/bracelet-code')
export class BraceletCodeController {
  constructor(private readonly service: BraceletCodeService) {}

  @Post('encode')
  @Access('admin')
  encode(@Body() dto: EncodeBraceletCodeDto) {
    return { code: this.service.encode({ v: 1, ...dto }) };
  }

  @Post('resolve')
  resolve(@Body() dto: ResolveBraceletCodeDto) {
    return this.service.resolve(dto.code);
  }
}
