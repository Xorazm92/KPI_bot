import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportTypeEntity } from './entities/report-type.entity';
import { ReportSubmissionEntity } from './entities/report-submission.entity';
import { ReportSubmissionService } from './report-submission.service';
import { ReportSubmissionUpdate } from './report-submission.update';
import { UserManagementModule } from '../user-management/user-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportTypeEntity, ReportSubmissionEntity]),
    UserManagementModule,
  ],
  providers: [ReportSubmissionService, ReportSubmissionUpdate],
  exports: [ReportSubmissionService],
})
export class ReportSubmissionModule {}
