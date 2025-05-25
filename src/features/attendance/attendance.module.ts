import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceLogEntity } from './entities/attendance-log.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceUpdate } from './attendance.update';
import { UserManagementModule } from '../user-management/user-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceLogEntity]),
    UserManagementModule,
  ],
  providers: [AttendanceService, AttendanceUpdate],
  exports: [AttendanceService],
})
export class AttendanceModule {}
