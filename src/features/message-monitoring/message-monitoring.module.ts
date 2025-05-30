import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageMonitoringService } from './message-monitoring.service';
import { MessageLogEntity } from '../message-logging/entities/message-log.entity';
import { MessageResponseEntity } from '../message-logging/entities/message-response.entity';
import { UserEntity } from '../user-management/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessageLogEntity,
      MessageResponseEntity,
      UserEntity,
    ]),
  ],
  providers: [MessageMonitoringService],
  exports: [MessageMonitoringService],
})
export class MessageMonitoringModule {}
