import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { escapeMarkdownV2 } from '../../common/utils/telegram-escape.util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Between } from 'typeorm';
import {
  MessageLogEntity,
  MessageDirection,
} from '../message-logging/entities/message-log.entity';
import { MessageResponseEntity } from '../message-logging/entities/message-response.entity';
import { UserEntity } from '../user-management/entities/user.entity';
import { UserRole } from '@common/enums/user-role.enum';
import { ConfigService } from '@nestjs/config';
// import { TelegramService } from '../../core/telegram/telegram.service';

@Injectable()
export class MessageMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MessageMonitoringService.name);

  // Har bir rol uchun javob berish vaqti (sekundlarda)
  private readonly responseTimeThresholds = {
    [UserRole.ACCOUNTANT]: 10 * 60, // 10 daqiqa
    [UserRole.BANK_CLIENT]: 10 * 60, // 10 daqiqa
    [UserRole.SUPERVISOR]: 10 * 60, // 10 daqiqa
    [UserRole.ADMIN]: 15 * 60, // 15 daqiqa
  };

  constructor(
    @InjectRepository(MessageLogEntity)
    private readonly messageLogRepository: Repository<MessageLogEntity>,
    @InjectRepository(MessageResponseEntity)
    private readonly responseRepository: Repository<MessageResponseEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    // private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('Message Monitoring Service initialized');
  }

  /**
   * Xabarni kuzatish uchun qo'shish
   */
  async logMessage(
    userId: string,
    chatId: string,
    messageId: string,
    direction: MessageDirection,
    text: string,
  ): Promise<MessageLogEntity> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        this.logger.warn(`Foydalanuvchi topilmadi: ${userId}`);
        throw new Error('Foydalanuvchi topilmadi');
      }

      const message = this.messageLogRepository.create({
        user,
        chatId: Number(chatId),
        direction,
        text,
        timestamp: new Date(),
      });

      await this.messageLogRepository.save(message);
      this.logger.log(`Yangi xabar qo'shildi: ${messageId} (${direction})`);

      // Agar xabar kiruvchi bo'lsa, javob kuzatishni boshlash
      if (direction === MessageDirection.INCOMING) {
        this.monitorResponse(message).catch((error) => {
          this.logger.error(
            `Javob kuzatishda xatolik: ${error.message}`,
            error.stack,
          );
        });
      }

      return message;
    } catch (error) {
      this.logger.error(
        `Xabarni saqlashda xatolik: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Javob berishni kuzatish
   */
  private async monitorResponse(message: MessageLogEntity): Promise<void> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: message.user.id },
        relations: ['chatRoles'],
      });

      if (!user) {
        this.logger.warn(`Foydalanuvchi topilmadi: ${message.user.id}`);
        return;
      }

      // Foydalanuvchi roli bo'yicha vaqt chegarasini olish
      const userRole = user.chatRoles?.[0]?.role || UserRole.ACCOUNTANT;
      const responseTimeThreshold =
        this.responseTimeThresholds[userRole] || 10 * 60; // standart 10 daqiqa

      // Javob kutilayotgan vaqtni hisoblash
      const responseDeadline = new Date(
        message.timestamp.getTime() + responseTimeThreshold * 1000,
      );

      // Javob kelguncha kutish
      setTimeout(async () => {
        const hasResponse = await this.checkForResponse(
          message,
          responseDeadline,
        );

        if (!hasResponse) {
          await this.handleLateResponse(message, userRole);
        }
      }, responseTimeThreshold * 1000);
    } catch (error) {
      this.logger.error(
        `Javobni kuzatishda xatolik: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Javob bor-yo'qligini tekshirish
   */
  private async checkForResponse(
    message: MessageLogEntity,
    deadline: Date,
  ): Promise<boolean> {
    const response = await this.messageLogRepository.findOne({
      where: {
        chatId: message.chatId,
        direction: MessageDirection.OUTGOING,
        timestamp: Between(message.timestamp, deadline),
      },
      order: { timestamp: 'ASC' },
    });

    return !!response;
  }

  /**
   * Kechikkan javob uchun ogohlantirish yuborish
   */
  private async handleLateResponse(
    message: MessageLogEntity,
    userRole: UserRole,
  ): Promise<void> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: message.user.id },
      });

      if (!user) return;

      // Ogohlantirish xabarini tayyorlash
      const warningMessage = this.prepareWarningMessage(
        user,
        userRole,
        message,
      );

      // Telegram orqali ogohlantirish yuborish
      // await this.telegramService.sendMessage({
      //   chat_id: user.telegramId,
      //   text: warningMessage,
      //   parse_mode: 'MarkdownV2',
      // });

      this.logger.log(`Ogohlantirish yuborildi: ${user.id} uchun`);
    } catch (error) {
      this.logger.error(
        `Ogohlantirish yuborishda xatolik: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Ogohlantirish xabarini tayyorlash
   */
  private prepareWarningMessage(
    user: UserEntity,
    userRole: UserRole,
    message: MessageLogEntity,
  ): string {
    const threshold = this.responseTimeThresholds[userRole] || 10 * 60;
    const thresholdMinutes = Math.floor(threshold / 60);

    const escapedText = escapeMarkdownV2(message.text ?? "").substring(0, 100);

    return (
      `⚠️ *Ogohlantirish* ⚠️\n` +
      `Sizga *${thresholdMinutes} daqiqa* ichida javob berish kerak edi\n` +
      `\n*Xabar:* ${escapedText}...\n` +
      `\nIltimos, tez orada javob bering!`
    );
  }

  /**
   * Foydalanuvchining javob vaqtlarini olish
   */
  async getUserResponseStats(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalMessages: number;
    responded: number;
    averageResponseTime: number;
  }> {
    const messages = await this.messageLogRepository.find({
      where: {
        user: { id: userId },
        direction: MessageDirection.INCOMING,
        timestamp: Between(startDate, endDate),
      },
      relations: ['responses'],
    });

    const totalMessages = messages.length;
    let responded = 0;
    let totalResponseTime = 0;

    for (const message of messages) {
      if (message.responses?.length > 0) {
        responded++;
        const responseTime =
          (message.responses[0].responseTime.getTime() -
            message.timestamp.getTime()) /
          1000;
        totalResponseTime += responseTime;
      }
    }

    return {
      totalMessages,
      responded,
      averageResponseTime:
        responded > 0 ? Math.round(totalResponseTime / responded) : 0,
    };
  }

  /**
   * Xabarga javob qo'shish
   */
  async addResponse(
    originalMessageId: string,
    responseMessageId: string,
    responderId: string,
    responseText: string,
  ): Promise<MessageResponseEntity> {
    const originalMessage = await this.messageLogRepository.findOne({
      where: { id: originalMessageId },
    });

    if (!originalMessage) {
      throw new Error('Original xabar topilmadi');
    }

    const responseTime = Math.floor(
      (Date.now() - originalMessage.timestamp.getTime()) / 1000,
    );

    const response = this.responseRepository.create({
      originalMessageId,
      responseMessageId,
      responderId,
      responseTime: new Date(),
      responseTimeSeconds: responseTime,
      responseText,
    });

    // Original xabarni yangilash
    // originalMessage.isResponded = true;
    // originalMessage.responseTime = responseTime;
    // originalMessage.status = 'resolved';

    await this.messageLogRepository.save(originalMessage);
    return this.responseRepository.save(response);
  }
}
