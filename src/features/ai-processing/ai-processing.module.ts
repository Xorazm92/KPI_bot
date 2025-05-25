import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { AiQueueService } from './ai-queue.service';
import { SttProcessor } from './stt.processor'; 
import { LlmProcessor } from './llm.processor'; 
import { TelegramBaseModule } from '../telegram-base/telegram-base.module'; 
import { MessageLoggingModule } from '../message-logging/message-logging.module'; 

@Module({
  imports: [
    HttpModule,
    BullModule.forRootAsync({
      useFactory: async () => ({
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: 'stt-queue',
      },
    ),
    BullModule.registerQueue(
      {
        name: 'llm-analysis-queue',
      },
    ),
    forwardRef(() => TelegramBaseModule), 
    MessageLoggingModule, 
  ],
  providers: [AiQueueService, SttProcessor, LlmProcessor], 
  exports: [AiQueueService, SttProcessor, LlmProcessor, BullModule],
})
export class AiProcessingModule {}
