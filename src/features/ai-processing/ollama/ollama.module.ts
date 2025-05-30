import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OllamaService } from './ollama.service';

@Module({
  imports: [HttpModule],
  providers: [OllamaService],
  exports: [OllamaService],
})
export class OllamaModule {}
