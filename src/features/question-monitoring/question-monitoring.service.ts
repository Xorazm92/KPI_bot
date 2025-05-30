import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserChatRoleEntity } from '../user-management/entities/user-chat-role.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { OllamaService } from '../ai-processing/ollama/ollama.service';
import { TelegramBaseService } from '../telegram-base/telegram-base.service';
import { UserEntity } from '../user-management/entities/user.entity';

export interface QuestionAnalysisResult {
  savol: string;
  rol: UserRole;
  javob_vaqti: string;
  status: 'KUTILMOQDA' | 'JAVOB_BERILDI' | 'MUDDAT_OTDI';
}

@Injectable()
export class QuestionMonitoringService {
  private readonly logger = new Logger(QuestionMonitoringService.name);
  private readonly responseTimes = {
    [UserRole.ACCOUNTANT]: 10 * 60 * 1000,
    [UserRole.BANK_CLIENT]: 10 * 60 * 1000,
    [UserRole.SUPERVISOR]: 10 * 60 * 1000,
  };

  private pendingQuestions = new Map<
    number,
    {
      question: string;
      role: UserRole;
      chatId: number;
      questionTime: Date;
      timeoutId: NodeJS.Timeout;
    }
  >();

  constructor(
    @InjectRepository(UserChatRoleEntity)
    private readonly userChatRoleRepository: Repository<UserChatRoleEntity>,
    private readonly ollamaService: OllamaService,
    @Inject(forwardRef(() => TelegramBaseService))
    private readonly telegramBaseService: TelegramBaseService,
  ) {}

  async processNewQuestion(
    question: string,
    chatId: number,
    questionTime: Date = new Date(),
  ): Promise<void> {
    try {
      // AI orqali savolni tahlil qilamiz
      const analysis = await this.analyzeQuestion(question);

      // Javob berish muddatini hisoblaymiz
      const responseTime = this.responseTimes[analysis.rol] || 10 * 60 * 1000;
      const responseDeadline = new Date(questionTime.getTime() + responseTime);

      // Timeout sozlaymiz
      const timeUntilResponse = responseDeadline.getTime() - Date.now();
      const timeoutId = setTimeout(
        () => this.handleResponseTimeout(analysis, chatId, questionTime),
        timeUntilResponse,
      );

      // Saqlab qo'yamiz
      this.pendingQuestions.set(questionTime.getTime(), {
        question,
        role: analysis.rol,
        chatId,
        questionTime,
        timeoutId,
      });

      this.logger.log(
        `Yangi savol qo'shildi: ${question} (${analysis.rol} uchun)`,
      );
    } catch (error) {
      this.logger.error(
        `Savolni qayta ishlashda xato: ${error.message}`,
        error.stack,
      );
    }
  }

  async handleResponse(
    question: string,
    responder: UserEntity,
    chatId: number,
  ): Promise<void> {
    // Javob berilgan savolni topamiz
    for (const [timestamp, questionData] of this.pendingQuestions.entries()) {
      if (
        question.includes(questionData.question) ||
        questionData.question.includes(question)
      ) {
        // Timeout ni to'xtatamiz
        clearTimeout(questionData.timeoutId);

        // Savolni olib tashlaymiz
        this.pendingQuestions.delete(timestamp);

        this.logger.log(
          `Savolga javob berildi: ${questionData.question} (${questionData.role})`,
        );
        return;
      }
    }
  }

  private async handleResponseTimeout(
    analysis: QuestionAnalysisResult,
    chatId: number,
    questionTime: Date,
  ): Promise<void> {
    try {
      // Tegishli roldagi foydalanuvchilarni topamiz
      const responsibleUsers = await this.userChatRoleRepository.find({
        where: {
          chatId,
          role: analysis.rol,
        },
        relations: ['user'],
      });

      if (responsibleUsers.length === 0) {
        this.logger.warn(
          `Ushbu rolda foydalanuvchilar topilmadi: ${analysis.rol}`,
        );
        return;
      }

      // Ogohlantirish xabarini tayyorlaymiz
      const usernames = responsibleUsers
        .map((ucr) => `@${ucr.user.username || ucr.user.telegramId}`)
        .join(', ');

      const now = new Date();
      const delayMinutes = Math.floor(
        (now.getTime() - questionTime.getTime()) / (60 * 1000),
      );

      // MarkdownV2 uchun escape qilish
      function escapeMarkdownV2(text: any): string {
        if (!text) return '';
        return String(text).replace(/[\\_\*\[\]\(\)~`>#+\-=|{}\.\!]/g, (match) => `\\${match}`);
      }
      const warningMessage =
        `🔔 JAVOB KUTILMOQDA\n` +
        `Savol: ${escapeMarkdownV2(analysis.savol)}\n` +
        `Javob berishi kerak: ${escapeMarkdownV2(analysis.rol)} (${escapeMarkdownV2(usernames)})\n` +
        `Kechikish: ${delayMinutes} daqiqa`;

      await this.telegramBaseService.sendMessage(chatId, warningMessage, { parse_mode: 'MarkdownV2' });
      this.logger.log(`Ogohlantirish yuborildi: ${warningMessage}`);
    } catch (error) {
      this.logger.error(
        `Ogohlantirish yuborishda xato: ${error.message}`,
        error.stack,
      );
    }
  }

  private async analyzeQuestion(
    question: string,
  ): Promise<QuestionAnalysisResult> {
    const prompt =
      `Savol: ${question}\n\n` +
      `Ushbu savol qaysi rolni qiziqtiradi? (ACCOUNTANT/BANK_CLIENT/SUPERVISOR)\n` +
      `Javob faqat JSON formatida bo'lsin.`;

    const response = await this.ollamaService.generateContent(prompt);

    try {
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
      }
      const result = JSON.parse(jsonStr);

      // AI typo mapping (fix BAKK_KLIENT etc)
      let aiRole = result.rol;
      if (aiRole === 'BAKK_KLIENT' || aiRole === 'BANK_KLIENT') {
        this.logger.warn(`AI noto'g'ri rol qaytardi: ${aiRole}, to'g'rilandi: BANK_CLIENT`);
        aiRole = 'BANK_CLIENT';
      }
      if (!Object.values(UserRole).includes(aiRole)) {
        this.logger.error(`AI noma'lum rol qaytardi: ${aiRole}, fallback: SUPERVISOR`);
        aiRole = UserRole.SUPERVISOR;
      }
      return {
        savol: question,
        rol: aiRole as UserRole,
        javob_vaqti: new Date().toISOString(),
        status: 'KUTILMOQDA',
      };
    } catch (error) {
      this.logger.error(
        `Javobni tahlil qilishda xato: ${error.message}`,
        error.stack,
      );
      // Agar xatolik bo'lsa, standart qiymat qaytaramiz
      return {
        savol: question,
        rol: UserRole.ACCOUNTANT, // Standart rol
        javob_vaqti: new Date().toISOString(),
        status: 'KUTILMOQDA',
      };
    }
  }
}
