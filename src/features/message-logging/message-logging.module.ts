import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageLoggingService } from './message-logging.service';
import { MessageLogEntity } from './entities/message-log.entity';
import { ResponseTimeModule } from '../response-time/response-time.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageLogEntity]),
    ResponseTimeModule,
  ],
  providers: [MessageLoggingService],
  exports: [MessageLoggingService],
})
export class MessageLoggingModule {}
