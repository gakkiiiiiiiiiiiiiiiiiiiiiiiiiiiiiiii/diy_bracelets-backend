import { Global, Module } from '@nestjs/common';
import { OpenAiProviderService } from './openai-provider.service';
import { ImageAssetsService } from './image-assets.service';

@Global()
@Module({
  providers: [OpenAiProviderService, ImageAssetsService],
  exports: [OpenAiProviderService, ImageAssetsService],
})
export class AiModule {}
