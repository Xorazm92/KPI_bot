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

export enum AttendanceStatus {
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  ABSENT_WITH_REASON = 'ABSENT_WITH_REASON', // Sababli kelmagan
  ABSENT_WITHOUT_REASON = 'ABSENT_WITHOUT_REASON', // Sababsiz kelmagan
  ON_LEAVE = 'ON_LEAVE', // Ta'tilda
  SICK_LEAVE = 'SICK_LEAVE', // Kasallik varaqasi
}

@Entity('attendance_logs')
@Index(['user', 'date'], { unique: true }) // Bir foydalanuvchi uchun bir kunda faqat bitta yozuv bo'lishi kerak
export class AttendanceLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, { nullable: false, eager: true })
  user: UserEntity;

  @Index()
  @Column({ type: 'date' })
  date: string; // YYYY-MM-DD formatida sana

  @Column({ type: 'timestamp', nullable: true })
  checkInTime?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  checkInNotes?: string; // Kelishdagi izoh (masalan, kechikish sababi)

  @Column({ type: 'timestamp', nullable: true })
  checkOutTime?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  checkOutNotes?: string; // Ketishdagi izoh

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    nullable: true, // Dastlab null bo'lishi mumkin, check-in qilinmaguncha
  })
  status?: AttendanceStatus;

  @Column({ type: 'int', nullable: true })
  durationMinutes?: number; // Ishlagan vaqti daqiqalarda

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
