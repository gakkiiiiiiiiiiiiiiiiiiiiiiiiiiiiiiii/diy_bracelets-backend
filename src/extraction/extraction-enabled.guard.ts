import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseBoolean } from '../config/environment';

@Injectable()
export class ExtractionEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!parseBoolean(this.config.get('AI_EXTRACTION_ENABLED'), false)) {
      throw new ServiceUnavailableException('自动素材提取默认关闭，请由运维显式设置 AI_EXTRACTION_ENABLED=true');
    }
    if (!this.config.get<string>('OPENAI_API_KEY', '').trim()) {
      throw new ServiceUnavailableException('OPENAI_API_KEY 未配置，无法接收素材提取图片');
    }
    return true;
  }
}
