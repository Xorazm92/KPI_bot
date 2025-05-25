import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiViewService } from './kpi-view.service';
import { KpiViewUpdate } from './kpi-view.update';
import { MessageLogEntity } from '../message-logging/entities/message-log.entity';
import { UserEntity } from '../user-management/entities/user.entity';
import { UserManagementModule } from '../user-management/user-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageLogEntity, UserEntity]),
    UserManagementModule,
  ],
  providers: [KpiViewService, KpiViewUpdate],
  // exports: [KpiViewService], // Agar boshqa modullar ham ishlatsa
})
export class KpiViewModule {}
