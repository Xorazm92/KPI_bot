import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiReportService } from './kpi-report.service';
import { KpiReportController } from './kpi-report.controller';
import { KpiReportEntity } from './entities/kpi-report.entity';
import { UserEntity } from '../user-management/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KpiReportEntity, UserEntity])],
  providers: [KpiReportService],
  controllers: [KpiReportController],
  exports: [KpiReportService],
})
export class KpiReportModule {}
