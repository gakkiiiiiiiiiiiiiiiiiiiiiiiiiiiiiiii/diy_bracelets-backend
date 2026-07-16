import { Global, Module } from '@nestjs/common';
import { OpenAiProviderService } from './openai-provider.service';
import { ImageAssetsService } from './image-assets.service';
import { CodexCliProviderService } from './codex-cli-provider.service';

@Global()
@Module({
  providers: [OpenAiProviderService, CodexCliProviderService, ImageAssetsService],
  exports: [OpenAiProviderService, CodexCliProviderService, ImageAssetsService],
})
export class AiModule {}
