import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResponseTimeService } from './response-time.service';
import { MessageLogEntity } from '../message-logging/entities/message-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MessageLogEntity])],
  providers: [ResponseTimeService],
  exports: [ResponseTimeService],
})
export class ResponseTimeModule {}
