import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { DesignReviewStatus } from '../designs/entities/design.entity';
import { ReviewInspirationDto, SubmitInspirationDto } from './dto/submit-inspiration.dto';
import { InspirationsService } from './inspirations.service';

@Controller('api/inspirations')
export class InspirationsController {
  constructor(private readonly inspirations: InspirationsService) {}

  @Get()
  list() { return this.inspirations.listPublic(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.inspirations.findOne(id); }

  @Post()
  submit(@Body() dto: SubmitInspirationDto) { return this.inspirations.submit(dto); }

  @Post('random/use')
  randomUse() { return this.inspirations.randomUse(); }

  @Post(':id/use')
  use(@Param('id') id: string) { return this.inspirations.use(id); }
}

@Controller('api/admin/inspirations')
export class AdminInspirationsController {
  constructor(private readonly inspirations: InspirationsService) {}

  @Get()
  list(@Query('status') status?: DesignReviewStatus) {
    return this.inspirations.listForReview(status ?? 'pending');
  }

  @Patch(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewInspirationDto) {
    return this.inspirations.review(id, dto);
  }
}
