import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { DesignReviewStatus } from '../designs/entities/design.entity';
import { ReviewInspirationDto, SubmitInspirationDto } from './dto/submit-inspiration.dto';
import { InspirationsService } from './inspirations.service';
import { Access } from '../auth/access.decorator';
import { CurrentUserId } from '../auth/current-auth.decorator';

@Access('public')
@Controller('api/inspirations')
export class InspirationsController {
  constructor(private readonly inspirations: InspirationsService) {}

  @Get()
  list() { return this.inspirations.listPublic(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.inspirations.findOne(id); }

  @Post()
  @Access('user')
  submit(@CurrentUserId() userId: string, @Body() dto: SubmitInspirationDto) {
    return this.inspirations.submit(userId, dto);
  }

  @Post('random/use')
  randomUse() { return this.inspirations.randomUse(); }

  @Post(':id/use')
  use(@Param('id') id: string) { return this.inspirations.use(id); }
}

@Access('admin')
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
