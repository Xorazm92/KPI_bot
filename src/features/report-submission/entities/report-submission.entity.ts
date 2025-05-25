import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { UserEntity } from '../../user-management/entities/user.entity';
import { ReportTypeEntity } from './report-type.entity';
import { ReportStatus } from '../enums/report-status.enum';

@Entity('report_submissions')
export class ReportSubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, { nullable: false, eager: true })
  submittedByUser: UserEntity; // Kim topshirganligi

  @Index()
  @ManyToOne(() => ReportTypeEntity, { nullable: false, eager: true })
  reportType: ReportTypeEntity; // Hisobot turi

  @Column({ type: 'text', nullable: true })
  title?: string; // Hisobot sarlavhasi (ixtiyoriy)

  @Column({ type: 'text', nullable: true })
  description?: string; // Hisobot tavsifi (ixtiyoriy)

  @Column({ type: 'varchar', length: 255, nullable: true })
  telegramFileId?: string; // Telegramdagi fayl IDsi (agar fayl biriktirilgan bo'lsa)

  @Column({ type: 'varchar', length: 1000, nullable: true })
  fileUrl?: string; // Fayl URL manzili (agar tashqi joylashuv bo'lsa)

  @Index()
  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.SUBMITTED,
  })
  status: ReportStatus; // Hisobot statusi

  @ManyToOne(() => UserEntity, { nullable: true, eager: true })
  reviewedByUser?: UserEntity; // Kim tomonidan ko'rib chiqilganligi (tasdiqlangan/rad etilgan)

  @Column({ type: 'text', nullable: true })
  reviewComment?: string; // Ko'rib chiqish izohi

  @CreateDateColumn()
  submittedAt: Date; // Topshirilgan sana

  @UpdateDateColumn()
  updatedAt: Date; // Oxirgi o'zgartirilgan sana

  @Column({ type: 'date', nullable: true })
  reportPeriodStartDate?: Date; // Hisobot davrining boshlanish sanasi

  @Column({ type: 'date', nullable: true })
  reportPeriodEndDate?: Date; // Hisobot davrining tugash sanasi

  @Column({ type: 'bigint', nullable: true })
  chatId?: number; // Chat ID
}
