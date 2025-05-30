import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not, IsNull } from 'typeorm';
import { KpiScoreEntity } from './entities/kpi-score.entity';
// Import using path aliases
import { UserRole } from '@common/enums/user-role.enum';
import {
  MessageLogEntity,
  MessageDirection,
} from '@features/message-logging/entities/message-log.entity';
import { UserEntity } from '@features/user-management/entities/user.entity';
import { ConfigService } from '@nestjs/config';

// Extend UserEntity to include role property for KPI calculations
import { calculateTotalScore, calculateBonusesAndPenalties, KpiWeights } from '../kpi-calculation/kpi-utils';
interface UserWithRole extends UserEntity {
  role?: UserRole;
}

@Injectable()
export class KpiCalculationService implements OnModuleInit {
  private readonly logger = new Logger(KpiCalculationService.name);

  // Default role if user has no roles assigned
  private readonly defaultRole = UserRole.AGENT;

  // Weights for KPI calculation (can be configured via config service)
  private readonly kpiWeights: KpiWeights;

  /**
   * Get the user's role from their chat roles
   * @param userId The ID of the user
   * @returns The user's role or AGENT by default
   */
  private async getUserRole(userId: string): Promise<UserRole> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['chatRoles'],
      });

      // Return the first role found, or default to AGENT
      if (user && user.chatRoles && user.chatRoles.length > 0) {
        const firstRole = user.chatRoles[0] as any;
        if (firstRole && firstRole.role) {
          return firstRole.role as UserRole;
        }
      }

      return this.defaultRole;
    } catch (error) {
      this.logger.error(`Error getting user role for user ${userId}:`, error);
      return this.defaultRole;
    }
  }

  constructor(
    @InjectRepository(KpiScoreEntity)
    private readonly kpiScoreRepository: Repository<KpiScoreEntity>,
    @InjectRepository(MessageLogEntity)
    private readonly messageLogRepository: Repository<MessageLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly configService: ConfigService,
  ) {
    // Load weights from config or use defaults
    this.kpiWeights = {
      responseTime: this.configService.get<number>('KPI_WEIGHTS.RESPONSE_TIME', 0.35),
      reportSubmission: this.configService.get<number>('KPI_WEIGHTS.REPORT_SUBMISSION', 0.25),
      attendance: this.configService.get<number>('KPI_WEIGHTS.ATTENDANCE', 0.25),
      quality: this.configService.get<number>('KPI_WEIGHTS.QUALITY', 0.15),
    };
  }

  async onModuleInit() {
    this.logger.log('KPI Calculation Service initialized');
  }

  /**
   * Calculate KPI score for a specific user and period
   */
  private async calculateKpiForUser(
    user: UserWithRole,
    startDate: Date,
    endDate: Date,
  ): Promise<KpiScoreEntity> {
    // Get user's role
    const userRole = await this.getUserRole(user.id);
    this.logger.log(
      `Calculating KPI for user ${user.id} with role ${userRole}`,
    );

    // Get or create KPI score record
    let kpiScore = await this.kpiScoreRepository.findOne({
      where: {
        user: { id: user.id },
        periodStart: startDate,
        periodEnd: endDate,
      },
    });

    if (!kpiScore) {
      kpiScore = this.kpiScoreRepository.create({
        user,
        role: user.role,
        periodStart: startDate,
        periodEnd: endDate,
      });
    }

    // Calculate each KPI component
    await this.calculateResponseTimeKpi(kpiScore, user, startDate, endDate);
    await this.calculateReportSubmissionKpi(kpiScore, user, startDate, endDate);
    await this.calculateAttendanceKpi(kpiScore, user, startDate, endDate);
    await this.calculateQualityKpi(kpiScore, user, startDate, endDate);

    // Calculate final weighted score
    kpiScore.finalScore = this.calculateWeightedScore(kpiScore);

    // Calculate bonuses and penalties based on final score
    await this.calculateBonusesAndPenalties(kpiScore);

    // Save and return the KPI score
    return this.kpiScoreRepository.save(kpiScore);
  }

  /**
   * Calculate response time KPI component
   */
  private async calculateResponseTimeKpi(
    kpiScore: KpiScoreEntity,
    user: UserEntity,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    // Get all incoming messages that might be questions for this user
    const potentialQuestions = await this.messageLogRepository.find({
      where: {
        chatId: user.telegramId, // Assuming user has a telegramId field
        direction: MessageDirection.INCOMING,
        timestamp: Between(startDate, endDate),
      },
      order: { timestamp: 'ASC' },
    });

    kpiScore.totalQuestions = potentialQuestions.length;

    if (potentialQuestions.length === 0) {
      kpiScore.responseTimeScore = 0;
      return;
    }

    // Count on-time and late responses
    let onTimeResponses = 0;

    for (const question of potentialQuestions) {
      // Find the first outgoing message from this user after the question
      const responses = await this.messageLogRepository.find({
        where: {
          chatId: question.chatId,
          user: { id: user.id },
          direction: MessageDirection.OUTGOING,
          timestamp: Between(
            question.timestamp,
            new Date(question.timestamp.getTime() + 24 * 60 * 60 * 1000),
          ),
        },
        order: { timestamp: 'ASC' },
        take: 1,
      });

      if (responses.length > 0) {
        const response = responses[0];
        const responseTimeMs =
          response.timestamp.getTime() - question.timestamp.getTime();
        const responseTimeSeconds = Math.floor(responseTimeMs / 1000);

        // Get user's role
        const userRole = await this.getUserRole(user.id);
        const responseTimeThreshold = [
          UserRole.NAZORATCHI,
          UserRole.SUPERVISOR,
        ].includes(userRole)
          ? 600
          : 1800; // 10 or 30 minutes in seconds

        if (responseTimeSeconds <= responseTimeThreshold) {
          onTimeResponses++;
        }

        // Calculate response time score (0-100)
        const responseTimeRatio =
          potentialQuestions.length > 0
            ? onTimeResponses / potentialQuestions.length
            : 0;
        kpiScore.responseTimeScore = Math.round(responseTimeRatio * 100);
      }
    }

    kpiScore.onTimeResponses = onTimeResponses;
    kpiScore.lateResponses = potentialQuestions.length - onTimeResponses;
    kpiScore.responseTimeScore =
      (onTimeResponses / potentialQuestions.length) * 100;
  }

  /**
   * Calculate report submission KPI component
   */
  private async calculateReportSubmissionKpi(
    kpiScore: KpiScoreEntity,
    user: UserEntity,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    // Implementation depends on your report submission tracking
    // This is a placeholder implementation
    kpiScore.totalReports = 10; // Example value
    kpiScore.onTimeReports = 8; // Example value
    kpiScore.lateReports = 2; // Example value
    kpiScore.reportSubmissionScore =
      (kpiScore.onTimeReports / kpiScore.totalReports) * 100;
  }

  /**
   * Calculate attendance KPI component
   */
  private async calculateAttendanceKpi(
    kpiScore: KpiScoreEntity,
    user: UserEntity,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    // Implementation depends on your attendance tracking
    // This is a placeholder implementation
    kpiScore.totalWorkDays = 22; // Example value
    kpiScore.onTimeArrivals = 20; // Example value
    kpiScore.lateArrivals = 2; // Example value
    kpiScore.attendanceScore =
      (kpiScore.onTimeArrivals / kpiScore.totalWorkDays) * 100;
  }

  /**
   * Calculate quality KPI component based on AI analysis
   */
  private async calculateQualityKpi(
    kpiScore: KpiScoreEntity,
    user: UserEntity,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    // Get all messages with quality analysis for this user
    const messages = await this.messageLogRepository.find({
      where: {
        user: { id: user.id },
        // Using type assertion for llmAnalysisStatus as it might be a custom enum
        llmAnalysisStatus: 'COMPLETED' as any,
        llmStructuredResponse: Not(IsNull()),
        timestamp: Between(startDate, endDate),
      },
    });

    if (messages.length === 0) {
      kpiScore.responseQualityScore = 85; // Default score if no analysis
      return;
    }

    // Calculate average quality score from all analyzed messages
    let totalQualityScore = 0;

    for (const message of messages) {
      const qualityScore = message.llmStructuredResponse?.qualityScore;
      if (typeof qualityScore === 'number') {
        totalQualityScore += qualityScore;
      }
    }

    kpiScore.responseQualityScore = totalQualityScore / messages.length;
  }

  /**
   * Calculate final weighted score based on component scores and weights
   */
  private calculateWeightedScore(kpiScore: KpiScoreEntity): number {
    return calculateTotalScore(
      {
        responseTime: kpiScore.responseTimeScore,
        reportSubmission: kpiScore.reportSubmissionScore,
        attendance: kpiScore.attendanceScore,
        quality: kpiScore.responseQualityScore,
      },
      this.kpiWeights
    );
  }

  /**
   * Calculate bonuses and penalties based on final score
   */
  private async calculateBonusesAndPenalties(
    kpiScore: KpiScoreEntity,
  ): Promise<void> {
    // Use util for bonus/penalty calculation
    const baseSalary = kpiScore.user?.baseSalary || 5000000;
    const { bonusAmount, penaltyAmount } = calculateBonusesAndPenalties(kpiScore.finalScore, baseSalary);
    kpiScore.bonusAmount = bonusAmount;
    kpiScore.penaltyAmount = penaltyAmount;
    kpiScore.notes = this.getPerformanceNote(kpiScore.finalScore);
  }

  private getPerformanceNote(finalScore: number): string {
    if (finalScore >= 95) return 'Excellent performance';
    if (finalScore >= 85) return 'Good performance';
    if (finalScore >= 70) return 'Satisfactory performance';
    if (finalScore >= 60) return 'Needs improvement';
    return 'Unsatisfactory performance';
  }

  /**
   * Get KPI score for a specific user and period
   */
  async getKpiForUser(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<KpiScoreEntity> {
    const kpiScore = await this.kpiScoreRepository.findOne({
      where: {
        user: { id: userId },
        periodStart: startDate,
        periodEnd: endDate,
      },
      relations: ['user'],
    });

    if (!kpiScore) {
      throw new NotFoundException(
        'KPI score not found for the specified period',
      );
    }

    return kpiScore;
  }

  /**
   * Get all KPI scores for a specific period (for reporting)
   */
  async getKpiForPeriod(
    startDate: Date,
    endDate: Date,
    role?: UserRole,
  ): Promise<KpiScoreEntity[]> {
    const where: any = {
      periodStart: startDate,
      periodEnd: endDate,
    };

    if (role) {
      where.role = role;
    }

    return this.kpiScoreRepository.find({
      where,
      relations: ['user'],
      order: { finalScore: 'DESC' },
    });
  }
}
