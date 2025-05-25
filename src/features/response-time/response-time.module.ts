import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResponseTimeTrackingService } from './response-time.service';
import { MessageLogEntity } from '../message-logging/entities/message-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MessageLogEntity])],
  providers: [ResponseTimeTrackingService],
  exports: [ResponseTimeTrackingService],
})
export class ResponseTimeModule {}
