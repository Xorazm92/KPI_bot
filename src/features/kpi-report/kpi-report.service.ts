import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { calculateTotalScore, calculateBonusesAndPenalties, KpiWeights } from '../kpi-calculation/kpi-utils';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { KpiReportEntity, KpiReportStatus } from './entities/kpi-report.entity';
import {
  UserEntity,
} from '../user-management/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { MessageMonitoringService } from '../message-monitoring/message-monitoring.service';

@Injectable()
export class KpiReportService {
  private readonly logger = new Logger(KpiReportService.name);

  constructor(
    @InjectRepository(KpiReportEntity)
    private readonly kpiReportRepository: Repository<KpiReportEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly messageMonitoringService: MessageMonitoringService,
  ) {}

  // KPI hisobotini yaratish
  async createReport(
    userId: string,
    data: {
      title: string;
      description?: string;
      startDate: Date;
      endDate: Date;
      metrics: Record<string, any>;
    },
  ): Promise<KpiReportEntity> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    // KPI ballarini hisoblash
    // KPI vaznlarini config yoki defaultdan olish
    const weights: KpiWeights = {
      responseTime: 0.3,
      reportSubmission: 0.25,
      attendance: 0.25,
      quality: 0.2,
    };
    const totalScore = calculateTotalScore(data.metrics, weights);
    const { bonusAmount, penaltyAmount } = calculateBonusesAndPenalties(
      totalScore,
      user.baseSalary || 0,
    );

    const report = this.kpiReportRepository.create({
      ...data,
      user,
      userRole: user.chatRoles?.[0]?.role,
      totalScore,
      bonusAmount,
      penaltyAmount,
      status: KpiReportStatus.DRAFT,
    });

    return this.kpiReportRepository.save(report);
  }

  // KPI hisobotini yangilash
  async updateReport(
    reportId: string,
    userId: string,
    updates: Partial<KpiReportEntity>,
  ): Promise<KpiReportEntity> {
    const report = await this.kpiReportRepository.findOne({
      where: { id: reportId, userId },
    });

    if (!report) {
      throw new NotFoundException(
        "Hisobot topilmadi yoki sizda unga huquq yo'q",
      );
    }

    Object.assign(report, updates);

    // Agar metrikalar yangilansa, qayta hisoblash
    if (updates.metrics) {
      report.totalScore = this.calculateTotalScore(updates.metrics);
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (user) {
        const { bonusAmount, penaltyAmount } =
          this.calculateBonusesAndPenalties(
            report.totalScore,
            user.baseSalary || 0,
          );
        report.bonusAmount = bonusAmount;
        report.penaltyAmount = penaltyAmount;
      }
    }

    return this.kpiReportRepository.save(report);
  }

  // KPI hisobotini nashr qilish
  async publishReport(
    reportId: string,
    userId: string,
  ): Promise<KpiReportEntity> {
    const report = await this.kpiReportRepository.findOne({
      where: { id: reportId },
      relations: ['user'],
    });

    if (!report) {
      throw new NotFoundException('Hisobot topilmadi');
    }

    // Faqat admin yoki o'z hisobotini nashr qilishi mumkin
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (
      !user ||
      (report.userId !== userId &&
        !user.chatRoles?.some((role) =>
          [UserRole.ADMIN, UserRole.SUPERVISOR].includes(role.role),
        ))
    ) {
      throw new ForbiddenException(
        "Sizda ushbu amalni bajarish uchun ruxsat yo'q",
      );
    }

    report.status = KpiReportStatus.PUBLISHED;
    report.publishedAt = new Date();

    return this.kpiReportRepository.save(report);
  }

  // Foydalanuvchi hisobotlarini olish
  async getUserReports(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<KpiReportEntity[]> {
    const where: any = { userId };

    if (startDate && endDate) {
      where.startDate = Between(startDate, endDate);
    }

    return this.kpiReportRepository.find({
      where,
      order: { startDate: 'DESC' },
    });
  }

  // Barcha hisobotlarni olish (admin/nazoratchi uchun)
  async getAllReports(
    userId: string,
    filters: {
      startDate?: Date;
      endDate?: Date;
      userIds?: string[];
      status?: KpiReportStatus;
    } = {},
  ): Promise<KpiReportEntity[]> {
    // Faqat admin va nazoratchilar barcha hisobotlarni ko'ra olishlari mumkin
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['chatRoles'],
    });

    if (
      !user ||
      !user.chatRoles?.some((role) =>
        [UserRole.ADMIN, UserRole.SUPERVISOR].includes(role.role),
      )
    ) {
      throw new ForbiddenException(
        "Sizda ushbu ma'lumotlarni ko'rish uchun ruxsat yo'q",
      );
    }

    const where: any = {};

    if (filters.startDate && filters.endDate) {
      where.startDate = Between(filters.startDate, filters.endDate);
    }

    if (filters.userIds?.length) {
      where.userId = In(filters.userIds);
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return this.kpiReportRepository.find({
      where,
      relations: ['user'],
      order: { startDate: 'DESC' },
    });
  }

  // Xodimlar bo'yicha statistikani olish
  async getUserStats(userId: string, startDate: Date, endDate: Date) {
    // Xabarlar statistikasi
    const messageStats =
      await this.messageMonitoringService.getUserResponseStats(
        userId,
        startDate,
        endDate,
      );

    // Hisobotlar statistikasi
    const reports = await this.kpiReportRepository.find({
      where: {
        userId,
        startDate: Between(startDate, endDate),
        status: KpiReportStatus.PUBLISHED,
      },
      order: { startDate: 'ASC' },
    });

    // O'rtacha KPI
    const avgKpi =
      reports.length > 0
        ? reports.reduce((sum, report) => sum + report.totalScore, 0) /
          reports.length
        : 0;

    return {
      messageStats,
      totalReports: reports.length,
      averageKpi: Math.round(avgKpi * 100) / 100,
      reports: reports.map((r) => ({
        id: r.id,
        title: r.title,
        period: `${r.startDate.toISOString().split('T')[0]} - ${r.endDate.toISOString().split('T')[0]}`,
        score: r.totalScore,
        status: r.status,
      })),
    };
  }

  // KPI uchun umumiy ballni hisoblash
  private calculateTotalScore(metrics: Record<string, any>): number {
    // Sizning KPI hisoblash mantigingizga qarab o'zgartiring
    const weights = {
      responseTime: 0.3, // 30%
      reportSubmission: 0.25, // 25%
      attendance: 0.25, // 25%
      quality: 0.2, // 20%
    };

    return (
      (metrics.responseTime || 0) * weights.responseTime +
      (metrics.reportSubmission || 0) * weights.reportSubmission +
      (metrics.attendance || 0) * weights.attendance +
      (metrics.quality || 0) * weights.quality
    );
  }

  // Bonus va jarimalarni hisoblash
  private calculateBonusesAndPenalties(
    totalScore: number,
    baseSalary: number,
  ): { bonusAmount: number; penaltyAmount: number } {
    if (totalScore >= 95) {
      return {
        bonusAmount: baseSalary * 0.2, // 20% bonus
        penaltyAmount: 0,
      };
    } else if (totalScore >= 85) {
      return {
        bonusAmount: baseSalary * 0.1, // 10% bonus
        penaltyAmount: 0,
      };
    } else if (totalScore >= 70) {
      return {
        bonusAmount: 0,
        penaltyAmount: 0,
      };
    } else if (totalScore >= 60) {
      return {
        bonusAmount: 0,
        penaltyAmount: baseSalary * 0.1, // 10% jarima
      };
    } else {
      return {
        bonusAmount: 0,
        penaltyAmount: baseSalary * 0.2, // 20% jarima
      };
    }
  }
}
