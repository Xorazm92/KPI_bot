import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiDefinitionEntity } from './entities/kpi-definition.entity';
import { KpiDefinitionService } from './kpi-definition.service'; // Import qilindi

@Module({
  imports: [TypeOrmModule.forFeature([KpiDefinitionEntity])],
  providers: [KpiDefinitionService], // Qo'shildi
  exports: [KpiDefinitionService], // Qo'shildi
})
export class KpiMonitoringModule {}
