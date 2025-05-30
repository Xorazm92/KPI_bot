import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserEntity } from '../../user-management/entities/user.entity';
import { KpiFrequency } from '../enums/kpi-frequency.enum';
import { KpiStatus } from '../enums/kpi-status.enum';

@Entity('kpi_definitions')
export class KpiDefinitionEntity extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50 })
  metricName: string; // e.g., 'Sales Amount', 'Tasks Completed'

  @Column({ type: 'varchar', length: 20 })
  metricUnit: string; // e.g., 'USD', 'Count', 'Hours'

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  targetValue?: number;

  @Column({
    type: 'enum',
    enum: KpiFrequency,
    default: KpiFrequency.MONTHLY,
  })
  frequency: KpiFrequency;

  @Column({
    type: 'enum',
    enum: KpiStatus,
    default: KpiStatus.PENDING_APPROVAL,
  })
  status: KpiStatus;

  @Column({ type: 'date', nullable: true })
  startDate?: Date;

  @Column({ type: 'date', nullable: true })
  endDate?: Date;

  @Index()
  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: UserEntity;

  @Column({ type: 'uuid', nullable: true })
  approvedById?: string;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approvedById' })
  approvedBy?: UserEntity;

  @Column({ type: 'jsonb', nullable: true })
  additionalConfig?: Record<string, any>; // For any extra configuration specific to this KPI

  // Future: Could add relations to departments, projects, or specific users responsible for this KPI
}
