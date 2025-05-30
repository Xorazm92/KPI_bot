import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { KpiCalculationService } from './kpi-calculation.service';
import { KpiScoreEntity } from './entities/kpi-score.entity';
import { MessageLoggingModule } from '../../features/message-logging/message-logging.module';
import { UserManagementModule } from '../../features/user-management/user-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KpiScoreEntity]),
    ConfigModule,
    MessageLoggingModule,
    UserManagementModule,
  ],
  providers: [KpiCalculationService],
  exports: [KpiCalculationService],
})
export class KpiCalculationModule {}
