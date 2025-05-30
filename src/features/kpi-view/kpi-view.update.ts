import { Logger } from '@nestjs/common';
import { escapeMarkdownV2 } from '../../common/utils/telegram-escape.util';
import { Update, Ctx, Command, Action, Message } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import {
  KpiViewService,
  GeneralKpiReport,
  AgentKpiReport,
} from './kpi-view.service';
import { UserManagementService } from '../user-management/user-management.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { UserChatRoleEntity } from '../user-management/entities/user-chat-role.entity';
import { Repository } from 'typeorm';

@Update()
export class KpiViewUpdate {
  private readonly logger = new Logger(KpiViewUpdate.name);

  constructor(
    private readonly kpiViewService: KpiViewService,
    private readonly userManagementService: UserManagementService,
    @InjectRepository(UserChatRoleEntity)
    private readonly userChatRoleRepository: Repository<UserChatRoleEntity>,
  ) {}

  private formatDuration(seconds?: number): string {
    if (seconds === undefined || seconds === null) return 'N/A';
    if (seconds < 60) return `${seconds.toFixed(0)} soniya`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(0);
    return `${minutes} daqiqa ${remainingSeconds} soniya`;
  }

  private formatReport(
    report: GeneralKpiReport,
    periodDisplay: string,
  ): string {
    let message = `📊 *KPI Hisoboti (${periodDisplay})* 📊\n\n`;
    message += `Umumiy Savollar: ${report.totalQuestions}\n`;
    message += `Javob Berilgan: ${report.totalAnswered}\n`;
    message += `Kutilmoqda: ${report.totalPending}\n`;
    message += `Vaqti Tugagan: ${report.totalTimedOut}\n`;
    message += `O'rtacha Javob Vaqti: ${this.formatDuration(report.overallAverageResponseTimeSeconds)}\n\n`;

    if (report.agentsKpi.length > 0) {
      message += "*Agentlar Bo'yicha:*\n";
      report.agentsKpi.forEach((agent) => {
        message += `  👨‍💻 Agent: ${agent.agentName} (ID: ${agent.agentId})\n`;
        message += `    Javob Berilgan Savollar: ${agent.totalQuestionsAnswered}\n`;
        message += `    O'rtacha Javob Vaqti: ${this.formatDuration(agent.averageResponseTimeSeconds)}\n`;
        // message += `    Vaqti Tugagan Savollar: ${agent.totalTimedOutQuestions}\n`; // Bu hali aniq emas
      });
    }
    return message;
  }

  @Command('kpi_report')
  async onKpiReportCommand(
    @Ctx() ctx: Context,
    @Message('text') messageText: string,
  ): Promise<void> {
    this.logger.log(
      `<<<<< KPI_REPORT COMMAND HANDLER TRIGGERED by user ${ctx.from?.id} in chat ${ctx.chat?.id} >>>>>`,
    );
    const telegramUser = ctx.from;
    const chat = ctx.chat;

    if (!telegramUser || !chat) {
      this.logger.warn(
        'Cannot identify user or chat from context for /kpi_report command',
      );
      await ctx.reply('Sizni yoki chatni aniqlay olmadim.');
      return;
    }

    const userEntity = await this.userManagementService.getUserByTelegramId(
      telegramUser.id,
    );
    if (!userEntity) {
      this.logger.warn(
        `User with Telegram ID ${telegramUser.id} not found in database for /kpi_report.`,
      );
      await ctx.reply('Siz tizimda roʻyxatdan oʻtmagansiz.');
      return;
    }

    // Check user's role in the current chat
    const userChatRole = await this.userChatRoleRepository.findOne({
      where: { user: { id: userEntity.id }, chatId: chat.id },
    });

    if (
      !userChatRole ||
      (userChatRole.role !== UserRole.SUPERVISOR &&
        userChatRole.role !== UserRole.NAZORATCHI)
    ) {
      this.logger.warn(
        `User ${telegramUser.id} (DB ID: ${userEntity.id}, Chat Role: ${userChatRole?.role}) in chat ${chat.id} attempted to access /kpi_report without required role.`,
      );
      await ctx.reply(
        'Bu buyruq faqat ushbu chatdagi nazoratchi yoki supervayzerlar uchun.',
      );
      return;
    }

    const args = messageText.split(' ').slice(1);
    const periodArg = args[0] || 'today'; // 'today', 'yesterday', 'last7days', 'last30days', 'YYYY-MM-DD'
    let periodDisplay = periodArg;
    if (periodArg === 'today') periodDisplay = 'Bugun';
    else if (periodArg === 'yesterday') periodDisplay = 'Kecha';
    else if (periodArg === 'last7days') periodDisplay = 'Oxirgi 7 kun';
    else if (periodArg === 'last30days') periodDisplay = 'Oxirgi 30 kun';

    try {
      const report = await this.kpiViewService.getGeneralKpiReport(periodArg);
      const message = this.formatReport(report, periodDisplay);

      const escapedMessage = escapeMarkdownV2(message);

      await ctx.replyWithMarkdownV2(escapedMessage);
      // this.logger.log(`Supervisor ${userEntity.telegramId} (Role: ${userChatRole.role}) requested KPI report for period: ${periodArg} in chat ${chat.id}`);
    } catch (error) {
      this.logger.error('KPI hisobotini olishda xatolik:', error);
      // Provide more specific error feedback if available
      if (error.response && error.response.description) {
        await ctx.reply(
          `KPI hisobotini olishda xatolik yuz berdi: ${error.response.description}`,
        );
      } else {
        await ctx.reply(
          'KPI hisobotini olishda xatolik yuz berdi. Tafsilotlar uchun loglarni tekshiring.',
        );
      }
    }
  }

  @Command('kpi')
  async onKpiCommand(
    @Ctx() ctx: Context,
    @Message('text') messageText: string,
  ) {
    this.logger.log(
      `<<<<< KPI COMMAND HANDLER TRIGGERED by user ${ctx.from?.id} in chat ${ctx.chat?.id} >>>>>`,
    );
    const telegramUser = ctx.from;
    const chat = ctx.chat;

    if (!telegramUser || !chat) {
      this.logger.warn(
        'Cannot identify user or chat from context for /kpi command',
      );
      await ctx.reply('Sizni yoki chatni aniqlay olmadim.');
      return;
    }

    const userEntity = await this.userManagementService.getUserByTelegramId(
      telegramUser.id,
    );
    if (!userEntity) {
      this.logger.warn(
        `User with Telegram ID ${telegramUser.id} not found in database.`,
      );
      await ctx.reply('Siz tizimda roʻyxatdan oʻtmagansiz.');
      return;
    }

    // Check user's role in the current chat
    const userChatRole = await this.userChatRoleRepository.findOne({
      where: { user: { id: userEntity.id }, chatId: chat.id },
    });

    if (
      !userChatRole ||
      ![UserRole.SUPERVISOR, UserRole.NAZORATCHI, UserRole.AGENT].includes(
        userChatRole.role,
      )
    ) {
      this.logger.warn(
        `User ${telegramUser.id} (DB ID: ${userEntity.id}, Chat Role: ${userChatRole?.role}) in chat ${chat.id} attempted to access /kpi without required role.`,
      );
      await ctx.reply(
        'Bu buyruq faqat agentlar, nazoratchilar va supervayzerlar uchun.',
      );
      return;
    }

    this.logger.log(
      `User ${telegramUser.id} (Role: ${userChatRole.role}) requested KPI in chat ${chat.id}`,
    );

    const parts = messageText.split(' ');
    const period = parts.length > 1 ? parts[1].toLowerCase() : 'today'; // 'today', 'yesterday', 'last7days', 'last30days'

    try {
      const report = await this.kpiViewService.getGeneralKpiReport(period);

      let responseText = `**KPI Hisoboti (${period})**\n`;
      responseText += `*Umumiy Savollar:* ${report.totalQuestions}\n`;
      responseText += `*Javob Berilganlar:* ${report.totalAnswered}\n`;
      responseText += `*Kutilayotganlar:* ${report.totalPending}\n`;
      responseText += `*Muddati O'tganlar:* ${report.totalTimedOut}\n`;
      responseText += `*O'rtacha Javob Vaqti:* ${report.overallAverageResponseTimeSeconds ? this.formatDuration(report.overallAverageResponseTimeSeconds) : 'N/A'}\n\n`;

      if (report.agentsKpi && report.agentsKpi.length > 0) {
        responseText += '**Agentlar Boʻyicha:**\n';
        report.agentsKpi.forEach((agent) => {
          responseText += `  *Agent:* ${agent.agentName} (TGID: ${agent.agentId})\\n`;
          responseText += `    Jami Belgilangan Savollar: ${agent.totalQuestionsAssigned || 0}\n`; // Bu maydon hozircha 0 bo'ladi
          responseText += `    Javob Berilgan Savollar: ${agent.totalQuestionsAnswered || 0}\n`;
          responseText += `    O'rtacha Javob Vaqti: ${agent.averageResponseTimeSeconds ? this.formatDuration(agent.averageResponseTimeSeconds) : 'N/A'}\n`;
          responseText += `    Muddati O'tgan Savollar: ${agent.totalTimedOutQuestions || 0}\n`; // Bu maydon ham KpiViewService da hisoblanadi
        });
      }

      await ctx.replyWithMarkdown(responseText);
    } catch (error) {
      this.logger.error(
        `Error generating KPI report for period ${period}: ${error.message}`,
        error.stack,
      );
      await ctx.reply('KPI hisobotini yaratishda xatolik yuz berdi.');
    }
  }
}
