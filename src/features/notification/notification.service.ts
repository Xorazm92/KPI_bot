import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { escapeMarkdownV2 } from '../../common/utils/telegram-escape.util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import {
  NotificationEntity,
  NotificationStatus,
  NotificationType,
} from './entities/notification.entity';
import { UserEntity } from '../user-management/entities/user.entity';
// import { TelegramService } from '../../core/telegram/telegram.service';
import { ConfigService } from '@nestjs/config';

type NotificationOptions = {
  type?: NotificationType;
  metadata?: Record<string, any>;
  actionUrl?: string;
  sendTelegram?: boolean;
  telegramOptions?: {
    parse_mode?: 'MarkdownV2' | 'HTML';
    disable_web_page_preview?: boolean;
  };
};

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private readonly telegramEnabled: boolean;

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    // private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {
    this.telegramEnabled =
      this.configService.get<string>('TELEGRAM_BOT_TOKEN') !== undefined;
  }

  async onModuleInit() {
    this.logger.log('Notification Service initialized');
    if (!this.telegramEnabled) {
      this.logger.warn(
        'Telegram integration is disabled - TELEGRAM_BOT_TOKEN is not set',
      );
    }
  }

  /**
   * Bitta foydalanuvchiga bildirishnoma yuborish
   */
  async notifyUser(
    userId: string,
    title: string,
    message: string,
    options: NotificationOptions = {},
  ): Promise<NotificationEntity> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error(`Foydalanuvchi topilmadi: ${userId}`);
    }

    const notification = this.notificationRepository.create({
      user,
      title,
      message,
      type: options.type || NotificationType.INFO,
      metadata: options.metadata,
      actionUrl: options.actionUrl,
      status: NotificationStatus.PENDING,
    });

    await this.notificationRepository.save(notification);

    try {
      // Telegram orqali yuborish
      if (
        options.sendTelegram !== false &&
        this.telegramEnabled &&
        user.telegramId
      ) {
        await this.sendTelegramNotification(
          notification,
          user,
          options.telegramOptions,
        );
      }

      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
    } catch (error) {
      this.logger.error(
        `Bildirishnoma yuborishda xatolik: ${error.message}`,
        error.stack,
      );
      notification.status = NotificationStatus.FAILED;
      notification.error = error.message;
    }

    return this.notificationRepository.save(notification);
  }

  /**
   * Bir nechta foydalanuvchilarga bildirishnoma yuborish
   */
  async notifyUsers(
    userIds: string[],
    title: string,
    message: string,
    options: NotificationOptions = {},
  ): Promise<NotificationEntity[]> {
    const users = await this.userRepository.find({
      where: { id: In(userIds) },
    });

    const notifications = await Promise.all(
      users.map((user) =>
        this.notificationRepository.create({
          user,
          title,
          message,
          type: options.type || NotificationType.INFO,
          metadata: options.metadata,
          actionUrl: options.actionUrl,
          status: NotificationStatus.PENDING,
        }),
      ),
    );

    await this.notificationRepository.save(notifications);

    // Telegram orqali yuborish
    if (options.sendTelegram !== false && this.telegramEnabled) {
      await Promise.all(
        notifications.map(async (notification, index) => {
          const user = users[index];
          if (!user?.telegramId) return;

          try {
            await this.sendTelegramNotification(
              notification,
              user,
              options.telegramOptions,
            );
            notification.status = NotificationStatus.SENT;
            notification.sentAt = new Date();
          } catch (error) {
            this.logger.error(
              `Foydalanuvchiga bildirishnoma yuborishda xatolik ${user.id}: ${error.message}`,
            );
            notification.status = NotificationStatus.FAILED;
            notification.error = error.message;
          }
          return this.notificationRepository.save(notification);
        }),
      );
    }

    return notifications;
  }

  /**
   * Rol bo'yicha barcha foydalanuvchilarga bildirishnoma yuborish
   */
  async notifyByRole(
    role: string,
    title: string,
    message: string,
    options: NotificationOptions = {},
  ): Promise<NotificationEntity[]> {
    const users = (await this.userRepository.find({
      relations: ['chatRoles'],
    })).filter(u => u.chatRoles?.some(cr => cr.role === role));

    if (users.length === 0) {
      this.logger.warn(`Rol bo'yicha foydalanuvchilar topilmadi: ${role}`);
      return [];
    }

    return this.notifyUsers(
      users.map((u) => u.id),
      title,
      message,
      options,
    );
  }

  /**
   * Telegram orqali bildirishnoma yuborish
   */
  private async sendTelegramNotification(
    notification: NotificationEntity,
    user: UserEntity,
    telegramOptions: any = {},
  ): Promise<void> {
    if (!user.telegramId) {
      throw new Error(`Foydalanuvchining Telegram ID si topilmadi: ${user.id}`);
    }

    const defaultOptions = {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    };

    const message = this.formatTelegramMessage(
      notification.title,
      notification.message,
      notification.type,
    );

    // await this.telegramService.sendMessage({
    //   chat_id: user.telegramId,
    //   text: message,
    //   ...defaultOptions,
    //   ...telegramOptions,
    // });
  }

  /**
   * Telegram uchun xabar formati
   */
  private formatTelegramMessage(
    title: string,
    message: string,
    type: NotificationType = NotificationType.INFO,
  ): string {
    // Emojilarni belgilash
    const emojiMap = {
      [NotificationType.INFO]: 'ℹ️',
      [NotificationType.WARNING]: '⚠️',
      [NotificationType.DANGER]: '🔴',
      [NotificationType.SUCCESS]: '✅',
    };

    const emoji = emojiMap[type] || 'ℹ️';

    const escapedTitle = escapeMarkdownV2(title);
    const escapedMessage = escapeMarkdownV2(message);

    return `*${emoji} ${escapedTitle}*\n\n${escapedMessage}`;
  }

  /**
   * Foydalanuvchining barcha bildirishnomalarini olish
   */
  async getUserNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: NotificationStatus;
      type?: NotificationType;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<{ items: NotificationEntity[]; total: number }> {
    const {
      limit = 20,
      offset = 0,
      status,
      type,
      startDate,
      endDate,
    } = options;

    const where: any = { userId };

    if (status) where.status = status;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = Between(
        startDate || new Date(0),
        endDate || new Date(),
      );
    }

    const [items, total] = await this.notificationRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return { items, total };
  }

  /**
   * Bildirishnomani o'qilgan deb belgilash
   */
  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error("Bildirishnoma topilmadi yoki sizda unga ruxsat yo'q");
    }

    notification.isRead = true;
    notification.readAt = new Date();
    notification.status = NotificationStatus.READ;

    return this.notificationRepository.save(notification);
  }

  /**
   * Barcha o'qilmagan bildirishnomalarni o'qilgan deb belgilash
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date(), status: NotificationStatus.READ },
    );

    return { count: result.affected || 0 };
  }

  /**
   * Ogohlantirish yuborish (qo'shimcha formatlash bilan)
   */
  async sendAlert(
    userId: string,
    title: string,
    message: string,
    type: 'info' | 'warning' | 'danger' | 'success' = 'info',
  ): Promise<NotificationEntity> {
    return this.notifyUser(userId, title, message, {
      type: type as NotificationType,
      sendTelegram: true,
      telegramOptions: {
        parse_mode: 'MarkdownV2',
      },
    });
  }

  /**
   * Xatolik haqida xabar yuborish
   */
  async sendErrorNotification(
    userId: string,
    error: Error,
    context: Record<string, any> = {},
  ): Promise<NotificationEntity> {
    const title = 'Xatolik yuz berdi';
    const message =
      `*Xatolik:* \`${error.message}\`\n\n` +
      `*Fayl:* ${error.stack?.split('\n')[1]?.trim() || "Noma'lum"}\n` +
      `*Vaqt:* ${new Date().toISOString()}`;

    return this.notifyUser(userId, title, message, {
      type: NotificationType.DANGER,
      metadata: {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        context,
      },
      sendTelegram: true,
    });
  }
}
