import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AttendanceLogEntity,
  AttendanceStatus,
} from './entities/attendance-log.entity';
import { UserEntity } from '../user-management/entities/user.entity';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(AttendanceLogEntity)
    private readonly attendanceLogRepository: Repository<AttendanceLogEntity>,
  ) {}

  private getCurrentDateString(): string {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  async checkIn(
    user: UserEntity,
    notes?: string,
  ): Promise<AttendanceLogEntity> {
    const today = this.getCurrentDateString();
    this.logger.log(
      `User ${user.telegramId} attempting to check-in for date: ${today}`,
    );

    let attendanceLog = await this.attendanceLogRepository.findOne({
      where: { user: { id: user.id }, date: today },
    });

    if (attendanceLog && attendanceLog.checkInTime) {
      this.logger.warn(
        `User ${user.telegramId} has already checked in today at ${attendanceLog.checkInTime}.`,
      );
      throw new ConflictException(
        'Siz bugun uchun allaqachon ishga kelgansiz (check-in).',
      );
    }

    if (!attendanceLog) {
      attendanceLog = this.attendanceLogRepository.create({
        user: user,
        date: today,
      });
    }

    attendanceLog.checkInTime = new Date();
    attendanceLog.status = AttendanceStatus.CHECKED_IN;
    attendanceLog.checkInNotes = notes;
    // checkOutTime va durationMinutes check-out paytida o'rnatiladi

    try {
      const savedLog = await this.attendanceLogRepository.save(attendanceLog);
      this.logger.log(
        `User ${user.telegramId} checked in successfully at ${savedLog.checkInTime}. Log ID: ${savedLog.id}`,
      );
      return savedLog;
    } catch (error) {
      this.logger.error(
        `Error during check-in for user ${user.telegramId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async checkOut(
    user: UserEntity,
    notes?: string,
  ): Promise<AttendanceLogEntity> {
    const today = this.getCurrentDateString();
    this.logger.log(
      `User ${user.telegramId} attempting to check-out for date: ${today}`,
    );

    const attendanceLog = await this.attendanceLogRepository.findOne({
      where: { user: { id: user.id }, date: today },
    });

    if (!attendanceLog || !attendanceLog.checkInTime) {
      this.logger.warn(
        `User ${user.telegramId} cannot check-out without a prior check-in for today.`,
      );
      throw new NotFoundException(
        'Siz bugun uchun hali ishga kelmagansiz (check-in qilmagansiz).',
      );
    }

    if (attendanceLog.checkOutTime) {
      this.logger.warn(
        `User ${user.telegramId} has already checked out today at ${attendanceLog.checkOutTime}.`,
      );
      throw new ConflictException(
        'Siz bugun uchun allaqachon ishdan ketgansiz (check-out).',
      );
    }

    attendanceLog.checkOutTime = new Date();
    attendanceLog.status = AttendanceStatus.CHECKED_OUT;
    attendanceLog.checkOutNotes = notes;

    if (attendanceLog.checkInTime) {
      const durationMs =
        attendanceLog.checkOutTime.getTime() -
        attendanceLog.checkInTime.getTime();
      attendanceLog.durationMinutes = Math.round(durationMs / (1000 * 60));
    }

    try {
      const savedLog = await this.attendanceLogRepository.save(attendanceLog);
      this.logger.log(
        `User ${user.telegramId} checked out successfully at ${savedLog.checkOutTime}. Duration: ${savedLog.durationMinutes} minutes. Log ID: ${savedLog.id}`,
      );
      return savedLog;
    } catch (error) {
      this.logger.error(
        `Error during check-out for user ${user.telegramId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // TODO: Boshqa metodlar (masalan, kunlik hisobot, sababli kelmaganlikni qayd etish)
}
