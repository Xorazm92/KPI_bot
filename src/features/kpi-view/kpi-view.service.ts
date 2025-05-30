import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  In,
} from 'typeorm';
import { MessageLogEntity } from '../message-logging/entities/message-log.entity';
import { UserEntity } from '../user-management/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserChatRoleEntity } from '../user-management/entities/user-chat-role.entity';

export interface AgentKpiReport {
  agentId: number;
  agentName: string;
  totalQuestionsAssigned: number; // Agentga biriktirilgan umumiy savollar (agar shunday logika bo'lsa)
  totalQuestionsAnswered: number;
  averageResponseTimeSeconds?: number; // Faqat javob berilgan savollar uchun
  totalTimedOutQuestions: number;
}

export interface GeneralKpiReport {
  totalQuestions: number;
  totalAnswered: number;
  totalPending: number;
  totalTimedOut: number;
  overallAverageResponseTimeSeconds?: number;
  agentsKpi: AgentKpiReport[];
}

@Injectable()
export class KpiViewService {
  private readonly logger = new Logger(KpiViewService.name);

  constructor(
    @InjectRepository(MessageLogEntity)
    private readonly messageLogRepository: Repository<MessageLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserChatRoleEntity)
    private readonly userChatRoleRepository: Repository<UserChatRoleEntity>,
  ) {}

  public getDateRange(
    period: 'today' | 'yesterday' | 'last7days' | 'last30days' | string,
  ): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate = new Date(now);
    let endDate = new Date(now);

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last7days':
        startDate.setDate(now.getDate() - 6); // 6 kun oldin + bugun = 7 kun
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999); // Bugungi kun oxirigacha
        break;
      case 'last30days':
        startDate.setDate(now.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        // Agar 'YYYY-MM-DD' formatida kelsa
        if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
          startDate = new Date(period);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(period);
          endDate.setHours(23, 59, 59, 999);
        } else {
          this.logger.warn(
            `Invalid period string: ${period}. Defaulting to today.`,
          );
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
        }
    }
    return { startDate, endDate };
  }

  async getGeneralKpiReport(
    period:
      | 'today'
      | 'yesterday'
      | 'last7days'
      | 'last30days'
      | string = 'today',
  ): Promise<GeneralKpiReport> {
    const { startDate, endDate } = this.getDateRange(period);
    this.logger.log(
      `Generating general KPI report for period: ${startDate.toISOString()} - ${endDate.toISOString()}`,
    );

    const questions = await this.messageLogRepository.find({
      where: {
        isQuestion: true,
        timestamp: Between(startDate, endDate),
      },
      relations: ['user', 'answeredByUser'], // Foydalanuvchi ma'lumotlarini olish uchun
    });

    const totalQuestions = questions.length;
    // Temporarily use string literals until QuestionStatus enum is properly defined and used
    const answeredQuestions = questions.filter(
      (q) =>
        q.questionStatusTemp === 'ANSWERED' && q.responseTimeSeconds != null,
    );
    const totalAnswered = answeredQuestions.length;
    const totalPending = questions.filter(
      (q) => q.questionStatusTemp === 'PENDING',
    ).length;
    const totalTimedOut = questions.filter(
      (q) => q.questionStatusTemp === 'TIMED_OUT',
    ).length;

    const overallAverageResponseTimeSeconds =
      answeredQuestions.length > 0
        ? answeredQuestions.reduce(
            (sum, q) => sum + (q.responseTimeSeconds || 0),
            0,
          ) / answeredQuestions.length
        : undefined;

    // Agentlar bo'yicha KPI
    const agentChatRoles = await this.userChatRoleRepository.find({
      where: { role: UserRole.ACCOUNTANT },
      relations: ['user'], // Ensure user entity is loaded
    });

    if (!agentChatRoles || agentChatRoles.length === 0) {
      this.logger.log('No agents found.');
      return {
        totalQuestions,
        totalAnswered,
        totalPending,
        totalTimedOut,
        overallAverageResponseTimeSeconds: overallAverageResponseTimeSeconds
          ? parseFloat(overallAverageResponseTimeSeconds.toFixed(2))
          : undefined,
        agentsKpi: [],
      };
    }

    // Extract unique UserEntities from agentChatRoles
    const agentUsersMap = new Map<string, UserEntity>();
    agentChatRoles.forEach((chatRole) => {
      if (chatRole.user) {
        // Ensure user is not null or undefined
        agentUsersMap.set(chatRole.user.id, chatRole.user);
      }
    });
    const agents = Array.from(agentUsersMap.values());

    if (agents.length === 0) {
      this.logger.log('No valid agent users extracted from chat roles.');
      return {
        totalQuestions,
        totalAnswered,
        totalPending,
        totalTimedOut,
        overallAverageResponseTimeSeconds: overallAverageResponseTimeSeconds
          ? parseFloat(overallAverageResponseTimeSeconds.toFixed(2))
          : undefined,
        agentsKpi: [],
      };
    }

    this.logger.log(`Found ${agents.length} agents to process KPI for.`);

    const agentsKpi: AgentKpiReport[] = [];

    for (const agent of agents) {
      const agentAnsweredQuestions = questions.filter(
        (q) =>
          q.answeredByUser &&
          q.answeredByUser.id === agent.id &&
          q.questionStatusTemp === 'ANSWERED',
      );
      const agentTimedOutQuestions = questions.filter(
        (q) => q.user.id === agent.id && q.questionStatusTemp === 'TIMED_OUT', // Assuming TIMED_OUT means agent missed it
      ).length;

      const avgResponseTime =
        agentAnsweredQuestions.length > 0
          ? agentAnsweredQuestions.reduce(
              (sum, q) => sum + (q.responseTimeSeconds || 0),
              0,
            ) / agentAnsweredQuestions.length
          : undefined;

      agentsKpi.push({
        agentId: agent.telegramId, // Use telegramId (number) instead of id (string)
        agentName:
          `${agent.firstName || ''} ${agent.lastName || ''}`.trim() ||
          agent.username ||
          `Agent TGID: ${agent.telegramId}`,
        totalQuestionsAssigned: 0, // Hozircha bu funksionallik yo'q
        totalQuestionsAnswered: agentAnsweredQuestions.length,
        averageResponseTimeSeconds: avgResponseTime
          ? parseFloat(avgResponseTime.toFixed(2))
          : undefined,
        totalTimedOutQuestions: agentTimedOutQuestions, // Bu ham aniqlashtirilishi kerak
      });
    }

    return {
      totalQuestions,
      totalAnswered,
      totalPending,
      totalTimedOut,
      overallAverageResponseTimeSeconds: overallAverageResponseTimeSeconds
        ? parseFloat(overallAverageResponseTimeSeconds.toFixed(2))
        : undefined,
      agentsKpi,
    };
  }

  // Kelajakda boshqa KPI metodlari qo'shilishi mumkin
  // Masalan, agentning ish yuklamasi, eng ko'p so'raladigan savollar va hokazo.
}
