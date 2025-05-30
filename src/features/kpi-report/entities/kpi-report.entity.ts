import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserEntity } from '../../user-management/entities/user.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

export enum KpiReportStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

/**
 * KpiReportEntity
 * KPI hisobotlari, har bir user va davr uchun.
 */
@Entity('kpi_reports')
@Index(['user', 'startDate', 'endDate'])
export class KpiReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: KpiReportStatus,
    default: KpiReportStatus.DRAFT,
  })
  status: KpiReportStatus;

  @Column('jsonb', { default: {} })
  metrics: {
    responseTime: number;
    reportSubmission: number;
    attendance: number;
    quality: number;
    [key: string]: any;
  };

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  totalScore: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  bonusAmount: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  penaltyAmount: number;

  @Column('text', { nullable: true })
  notes: string;

  @ManyToOne(() => UserEntity, (user) => user.kpiReports, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column({ nullable: true })
  userId: string;

  @Column({ type: 'enum', enum: UserRole, nullable: true })
  userRole: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  archivedAt: Date;

  constructor(partial: Partial<KpiReportEntity>) {
    Object.assign(this, partial);
  }
}
