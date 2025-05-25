import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, IsNull, Not } from 'typeorm';
import { MessageLogEntity, QuestionStatus, AnswerDetectionMethod, UserRole } from '../message-logging/entities/message-log.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

// Savol uchun javob kutish vaqti (millisekundlarda)
const QUESTION_TIMEOUT_MS = 30 * 60 * 1000; // 30 daqiqa

@Injectable()
export class ResponseTimeTrackingService {
  private readonly logger = new Logger(ResponseTimeTrackingService.name);
  private readonly TIME_WINDOW_MINUTES = 10;

  constructor(
    @InjectRepository(MessageLogEntity)
    private readonly messageLogRepository: Repository<MessageLogEntity>,
  ) {}

  async processNewMessageLog(newMessageLog: MessageLogEntity): Promise<void> {
    this.logger.debug(`Processing message log ID: ${newMessageLog.id} for response time tracking.`);

    const messageSenderRole = newMessageLog.senderRoleAtMoment;
    const rawTelegramMessage = newMessageLog.rawMessage as any;

    if (messageSenderRole !== UserRole.CLIENT && rawTelegramMessage?.reply_to_message) {
      const originalMessageId = rawTelegramMessage.reply_to_message.message_id;
      const originalChatId = newMessageLog.chatId;

      const originalQuestionLog = await this.messageLogRepository.findOne({
        where: {
          telegramMessageId: originalMessageId,
          chatId: originalChatId,
          senderRoleAtMoment: UserRole.CLIENT,
          isQuestion: true,
          questionStatus: QuestionStatus.PENDING,
        },
      });

      if (originalQuestionLog) {
        originalQuestionLog.questionStatus = QuestionStatus.ANSWERED;
        originalQuestionLog.answeredByMessageId = newMessageLog.telegramMessageId;
        originalQuestionLog.answeredByUser = newMessageLog.user;
        originalQuestionLog.responseTimeSeconds = Math.floor((newMessageLog.timestamp.getTime() - originalQuestionLog.timestamp.getTime()) / 1000);
        originalQuestionLog.answerDetectionMethod = AnswerDetectionMethod.REPLY;
        
        await this.messageLogRepository.save(originalQuestionLog);
        this.logger.log(
          `[REPLY] Marked question ${originalQuestionLog.id} (MsgID: ${originalQuestionLog.telegramMessageId}) as ANSWERED by message ${newMessageLog.id} (MsgID: ${newMessageLog.telegramMessageId}). Response time: ${originalQuestionLog.responseTimeSeconds}s.`,
        );
        return;
      }
    }

    if (messageSenderRole !== UserRole.CLIENT && !rawTelegramMessage?.reply_to_message) {
      const timeWindowStart = new Date(newMessageLog.timestamp.getTime() - this.TIME_WINDOW_MINUTES * 60 * 1000);

      const pendingClientQuestion = await this.messageLogRepository.findOne({
        where: {
          chatId: newMessageLog.chatId,
          senderRoleAtMoment: UserRole.CLIENT,
          isQuestion: true,
          questionStatus: QuestionStatus.PENDING,
          timestamp: MoreThan(timeWindowStart),
          answeredByMessageId: IsNull(),
        },
        order: { timestamp: 'DESC' },
      });

      if (pendingClientQuestion && pendingClientQuestion.timestamp < newMessageLog.timestamp) {
        pendingClientQuestion.questionStatus = QuestionStatus.ANSWERED;
        pendingClientQuestion.answeredByMessageId = newMessageLog.telegramMessageId;
        pendingClientQuestion.answeredByUser = newMessageLog.user;
        pendingClientQuestion.responseTimeSeconds = Math.floor((newMessageLog.timestamp.getTime() - pendingClientQuestion.timestamp.getTime()) / 1000);
        pendingClientQuestion.answerDetectionMethod = AnswerDetectionMethod.TIME_WINDOW_SIMPLE;

        await this.messageLogRepository.save(pendingClientQuestion);
        this.logger.log(
          `[TIME-WINDOW] Marked question ${pendingClientQuestion.id} (MsgID: ${pendingClientQuestion.telegramMessageId}) as (potentially) ANSWERED by message ${newMessageLog.id} (MsgID: ${newMessageLog.telegramMessageId}). Response time: ${pendingClientQuestion.responseTimeSeconds}s.`,
        );
      }
    }
  }

  // Bu metod har 5 daqiqada ishga tushadi
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkForTimedOutQuestions(): Promise<void> {
    this.logger.log('Checking for timed out questions...');
    const timeoutThreshold = new Date(Date.now() - QUESTION_TIMEOUT_MS);

    try {
      const pendingQuestions = await this.messageLogRepository.find({
        where: {
          isQuestion: true,
          questionStatus: QuestionStatus.PENDING,
          timestamp: LessThan(timeoutThreshold),
        },
      });

      if (pendingQuestions.length > 0) {
        this.logger.log(`Found ${pendingQuestions.length} pending questions to be timed out.`);
        for (const question of pendingQuestions) {
          question.questionStatus = QuestionStatus.TIMED_OUT;
          question.answerDetectionMethod = AnswerDetectionMethod.SYSTEM_TIMEOUT;
          // responseTimeSeconds bu holatda hisoblanmaydi yoki maxsus qiymatga ega bo'lishi mumkin
          await this.messageLogRepository.save(question);
          this.logger.log(`Question (ID: ${question.id}, TelegramMsgID: ${question.telegramMessageId}) timed out.`);
        }
      } else {
        this.logger.log('No pending questions found that need to be timed out.');
      }
    } catch (error) {
      this.logger.error('Error checking for timed out questions:', error.stack);
    }
  }
}
