import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserEntity } from '../../user-management/entities/user.entity';
import { ReportTypeEntity } from './report-type.entity';

export enum ReportStatus {
  SUBMITTED = 'SUBMITTED', // Topshirildi (muddat tekshirilmagan hali)
  ON_TIME = 'ON_TIME', // O'z vaqtida topshirildi
  LATE = 'LATE', // Kechikib topshirildi
  APPROVED = 'APPROVED', // Tasdiqlandi (masalan, SUPERVISOR tomonidan)
  REJECTED = 'REJECTED', // Rad etildi
}

@Entity('report_logs')
export class ReportLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, { nullable: false, eager: true })
  submittedByUser: UserEntity;

  @ManyToOne(() => ReportTypeEntity, { nullable: false, eager: true })
  reportType: ReportTypeEntity;

  @Index()
  @Column({ type: 'bigint' })
  chatId: number;

  @Column({ type: 'bigint' })
  messageId: number; // Hisobot fayli yoki buyrug'i kelgan xabar IDsi

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileId?: string; // Telegramdagi fayl IDsi

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName?: string;

  @Column({ type: 'text', nullable: true })
  submissionNotes?: string; // Foydalanuvchi tomonidan qo'shilgan izohlar

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.SUBMITTED })
  status: ReportStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  submissionTimestamp: Date; // Haqiqiy topshirilgan vaqt

  @Column({ type: 'timestamp', nullable: true })
  deadlineTimestamp?: Date; // Bu hisobot uchun belgilangan muddat

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
