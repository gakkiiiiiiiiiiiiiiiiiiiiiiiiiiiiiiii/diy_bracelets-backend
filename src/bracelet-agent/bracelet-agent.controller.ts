import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BraceletAgentService } from './bracelet-agent.service';
import { CreateAgentFeedbackDto, CreateAgentGenerationDto, RenderAgentBraceletDto } from './dto/agent.dto';

@Controller('api/admin/agent')
export class BraceletAgentController {
  constructor(private readonly service: BraceletAgentService) {}
  @Get('provider') provider() { return this.service.providerStatus(); }
  @Post('generations') create(@Body() dto: CreateAgentGenerationDto) { return this.service.create(dto); }
  @Get('generations') list(@Query('limit') limit?: string) { return this.service.list(limit); }
  @Get('generations/:id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post('feedback') feedback(@Body() dto: CreateAgentFeedbackDto) { return this.service.addFeedback(dto); }
  @Post('render') render(@Body() dto: RenderAgentBraceletDto) { return this.service.renderBracelet(dto); }
}
