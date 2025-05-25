import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WinstonLoggerModule } from './core/logger/logger.module';
import { AiQueueModule } from './core/queue/queue.module';
import { TelegramBaseModule } from './features/telegram-base/telegram-base.module';
import { UserManagementModule } from './features/user-management/user-management.module';
import { MessageLoggingModule } from './features/message-logging/message-logging.module';
import { ResponseTimeModule } from './features/response-time/response-time.module';
import { ReportSubmissionModule } from './features/report-submission/report-submission.module';
import { AttendanceModule } from './features/attendance/attendance.module';
import { AiModule } from './features/ai/ai.module';
import { KpiCalculationModule } from './features/kpi-calculation/kpi-calculation.module';
import { KpiViewModule } from './features/kpi-view/kpi-view.module';
import { AuditLogModule } from './features/audit-log/audit-log.module';
import { KpiMonitoringModule } from './features/kpi-monitoring/kpi-monitoring.module';
import databaseConfig from './config/database.config';
import telegramConfig from './config/telegram.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, telegramConfig],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),
    WinstonLoggerModule,
    AiQueueModule,
    TelegramBaseModule,
    UserManagementModule,
    MessageLoggingModule,
    ResponseTimeModule,
    ReportSubmissionModule,
    AttendanceModule,
    AiModule,
    KpiCalculationModule,
    KpiViewModule,
    KpiMonitoringModule,
    AuditLogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
