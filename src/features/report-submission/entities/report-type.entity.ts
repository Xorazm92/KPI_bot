import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserRole } from '../../../common/enums/user-role.enum';

export enum ReportFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
  ADHOC = 'ADHOC', // Maxsus topshiriqlar uchun
}

@Entity('report_types')
export class ReportTypeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  code: string; // Hisobotning qisqa kodi, masalan, 'MONTHLY_SALES'

  @Column({ type: 'varchar', length: 255 })
  name: string; // Hisobotning to'liq nomi

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: ReportFrequency, default: ReportFrequency.ADHOC })
  frequency: ReportFrequency;

  // Muddat qoidalari (masalan, 'MONTHLY' uchun har oyning 5-sanasi)
  // Buni yanada murakkablashtirish mumkin, hozircha oddiy matn
  @Column({ type: 'varchar', length: 255, nullable: true })
  deadlineRule?: string; 

  // Mas'ul rollar (qaysi rollar bu hisobotni topshirishi mumkin)
  @Column({ type: 'enum', enum: UserRole, array: true, nullable: true })
  responsibleRoles?: UserRole[];

  // Fayl namunasi yoki kutilgan xeshteglar (validatsiya uchun)
  @Column({ type: 'varchar', length: 255, nullable: true })
  fileTemplateHint?: string; // Masalan, '#monthly_report #sales'

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
