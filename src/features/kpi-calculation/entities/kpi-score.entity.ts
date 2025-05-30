import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserRole } from '../../../common/enums/user-role.enum';
import { UserEntity } from '../../user-management/entities/user.entity';

/**
 * KpiScoreEntity
 * KPI ballari va metrikalari, har bir user va davr uchun.
 */

@Entity('kpi_scores')
@Index(['user', 'periodStart', 'periodEnd'], { unique: true })
export class KpiScoreEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, (user) => user.kpiScores, {
    nullable: false,
    eager: true,
    onDelete: 'CASCADE',
  })
  user: UserEntity;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ type: 'date' })
  periodStart: Date;

  @Column({ type: 'date' })
  periodEnd: Date;

  // Response Time Metrics
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  responseTimeScore: number; // 0-100 score

  @Column({ type: 'integer', default: 0 })
  totalQuestions: number;

  @Column({ type: 'integer', default: 0 })
  onTimeResponses: number;

  @Column({ type: 'integer', default: 0 })
  lateResponses: number;

  // Report Submission Metrics
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  reportSubmissionScore: number; // 0-100 score

  @Column({ type: 'integer', default: 0 })
  totalReports: number;

  @Column({ type: 'integer', default: 0 })
  onTimeReports: number;

  @Column({ type: 'integer', default: 0 })
  lateReports: number;

  // Attendance Metrics
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  attendanceScore: number; // 0-100 score

  @Column({ type: 'integer', default: 0 })
  totalWorkDays: number;

  @Column({ type: 'integer', default: 0 })
  onTimeArrivals: number;

  @Column({ type: 'integer', default: 0 })
  lateArrivals: number;

  // Quality Metrics (from AI analysis)
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  responseQualityScore: number; // 0-100 score based on AI analysis

  // Final Score
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  finalScore: number; // Weighted average of all scores (0-100)

  // Bonuses and Penalties
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  bonusAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  penaltyAmount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  constructor(partial: Partial<KpiScoreEntity>) {
    Object.assign(this, partial);
  }
}
