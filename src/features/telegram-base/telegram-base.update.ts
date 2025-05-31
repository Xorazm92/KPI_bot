import {
  Logger,
  UseGuards,
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import {
  Update,
  Start,
  Help,
  On,
  Command,
  Ctx,
  Message,
} from 'nestjs-telegraf';
import { Context as TelegrafContext } from 'telegraf';
import {
  User as TelegrafUser,
  Chat as TelegrafChat,
  Message as TelegrafMessage,
} from 'telegraf/types';

import { UserManagementService } from '../user-management/user-management.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedGuard } from '../../common/guards/authenticated.guard';
import { User } from '../../common/decorators/user.decorator';
import { UserEntity } from '../user-management/entities/user.entity';
import { MessageLoggingService } from '../message-logging/message-logging.service';
import { MessageDirection } from '../message-logging/entities/message-log.entity';
import { KpiDefinitionService } from '../kpi-monitoring/kpi-definition.service';
import { CreateKpiDefinitionDto } from '../kpi-monitoring/dto/create-kpi-definition.dto';
import { AiQueueService } from '../ai-processing/ai-queue.service';
import { SttStatusEnum } from '../ai-processing/enums/stt-status.enum';
import { QuestionMonitoringService } from '../question-monitoring/question-monitoring.service';

interface TelegramError extends Error {
  message: string;
  stack?: string;
}

const Chat = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TelegrafChat => {
    const logger = new Logger('ChatDecorator');
    const telegrafCtx = ctx.getArgByIndex<TelegrafContext>(0);

    if (!telegrafCtx) {
      logger.warn('Telegraf context (telegrafCtx) is undefined or null.');
      throw new BadRequestException('Telegraf context is missing');
    }

    logger.log(`Telegraf context type: ${typeof telegrafCtx}`);
    logger.log(`Telegraf context keys: ${Object.keys(telegrafCtx).join(', ')}`);

    if (telegrafCtx.update) {
      try {
        logger.warn(
          'Telegraf Ctx Update Object:',
          JSON.stringify(telegrafCtx.update, null, 2),
        );
      } catch (e: any) {
        logger.error('Error stringifying telegrafCtx.update:', e.message);
        logger.warn('Telegraf Ctx Update Object (raw):', telegrafCtx.update);
      }
    } else {
      logger.warn('telegrafCtx.update is undefined.');
    }

    if (telegrafCtx.chat) {
      try {
        logger.log(
          'Telegraf Ctx Chat Object:',
          JSON.stringify(telegrafCtx.chat, null, 2),
        );
      } catch (e: any) {
        logger.error('Error stringifying telegrafCtx.chat:', e.message);
        logger.log('Telegraf Ctx Chat Object (raw):', telegrafCtx.chat);
      }
    } else {
      logger.warn('telegrafCtx.chat is undefined. This is the primary issue.');
      try {
        logger.warn(
          'Full Telegraf context (telegrafCtx) for debugging when chat is missing:',
          JSON.stringify(
            telegrafCtx,
            (key, value) => {
              if (value instanceof Buffer) {
                return '[Buffer data]';
              }
              return value;
            },
            2,
          ),
        );
      } catch (e: any) {
        logger.error('Error stringifying full telegrafCtx:', e.message);
        logger.warn(
          'Full Telegraf context (telegrafCtx) (raw, could be large/complex):',
          telegrafCtx,
        );
      }
      throw new BadRequestException('Chat context is required');
    }

    return telegrafCtx.chat;
  },
);

export const Sender = createParamDecorator(
  (data: unknown, ec: ExecutionContext): TelegrafUser => {
    const logger = new Logger('SenderDecorator');
    const telegrafCtx = ec.getArgByIndex<TelegrafContext>(0);

    logger.log(`Telegraf context type: ${typeof telegrafCtx}`);
    logger.log(`Telegraf context keys: ${Object.keys(telegrafCtx).join(', ')}`);

    if (!telegrafCtx) {
      logger.warn('Telegraf context (telegrafCtx) is undefined or null.');
      throw new BadRequestException('Telegraf context is missing');
    }

    if (!telegrafCtx.from) {
      logger.warn('telegrafCtx.from is undefined.');
      throw new BadRequestException('Sender context is required');
    }

    return telegrafCtx.from;
  },
);

@Update()
export class TelegramBaseUpdate {
  private readonly logger = new Logger(TelegramBaseUpdate.name);

  constructor(
    private readonly userManagementService: UserManagementService,
    private readonly messageLoggingService: MessageLoggingService,
    private readonly kpiDefinitionService: KpiDefinitionService,
    private readonly aiQueueService: AiQueueService,
    private readonly questionMonitoringService: QuestionMonitoringService,
  ) {
    this.logger.log('TelegramBaseUpdate instance created');
  }

  @Start()
  @UseGuards(AuthenticatedGuard)
  async onStart(
    @Ctx() ctx: TelegrafContext,
    @User() user: UserEntity,
    @Chat() chat: TelegrafChat,
  ) {
    const tgUser = ctx.from;
    // const chat = ctx.chat; // Yuqorida @Chat() orqali olingan

    if (!tgUser || !chat) {
      this.logger.warn('User or chat is undefined in onStart');
      await ctx.reply(
        'Xatolik: Foydalanuvchi yoki chat maʼlumotlari topilmadi.',
      );
      return;
    }

    this.logger.log(
      `User ${tgUser.id} (${tgUser.username}) started bot in chat ${chat.id} (${chat.type})`,
    );

    try {
      // Log the incoming /start command
      if (ctx.message) {
        const telegramMessage = ctx.message as TelegrafMessage;
        const { userChatRole, isNewUser, isNewChatRole } =
          await this.userManagementService.findOrCreateUserWithDefaultRoleInChat(
            user,
            chat,
          );
        await this.messageLoggingService.logMessage(
          telegramMessage,
          user,
          chat,
          MessageDirection.INCOMING,
          userChatRole.role, // Added senderRoleAtMoment
        );
      } else {
        this.logger.warn(
          `ctx.message is undefined in onStart for user ${user.telegramId}`,
        );
      }

      const { userChatRole, isNewUser, isNewChatRole } =
        await this.userManagementService.findOrCreateUserWithDefaultRoleInChat(
          user, // Pass the UserEntity obtained from @User decorator
          chat,
        );

      const replyMessageText = `Assalomu alaykum, ${user.firstName || user.username}! Botimizga xush kelibsiz.\nSizning rolingiz: ${userChatRole.role}`;
      // if (isNewUser) {
      //   replyMessageText += '\nSiz tizimda yangi foydalanuvchi sifatida roʻyxatdan oʻtdingiz.';
      // }
      // if (isNewChatRole) {
      //   replyMessageText += `\nUshbu chatda sizga standart rol (${userChatRole.role}) berildi.`;
      // }

      const sentReply = await ctx.reply(replyMessageText);
      if (sentReply && chat) {
        // chat mavjudligini tekshirish
        try {
          const botUser = await this.userManagementService.getBotUserEntity();
          await this.messageLoggingService.logMessage(
            sentReply,
            botUser,
            chat,
            MessageDirection.OUTGOING,
            UserRole.BOT, // Added senderRoleAtMoment
          );
        } catch (logError) {
          this.logger.error(
            `Failed to log outgoing message in onStart: ${logError.message}`,
            logError.stack,
          );
        }
      }
    } catch (error) {
      const err = error as TelegramError;
      this.logger.error(
        `Error in onStart for user ${tgUser.id}: ${err.message}`,
        err.stack,
      );
      const errorReplyText =
        'Botni ishga tushirishda xatolik yuz berdi. Iltimos, keyinroq qayta urinib koʻring.';
      const errorReply = await ctx.reply(errorReplyText);
      if (errorReply && chat) {
        // chat mavjudligini tekshirish
        try {
          const botUser = await this.userManagementService.getBotUserEntity();
          await this.messageLoggingService.logMessage(
            errorReply,
            botUser,
            chat,
            MessageDirection.OUTGOING,
            UserRole.BOT, // Added senderRoleAtMoment
          );
        } catch (logError) {
          this.logger.error(
            `Failed to log outgoing error reply in onStart: ${logError.message}`,
            logError.stack,
          );
        }
      }
    }
  }

  @Help()
  @UseGuards(AuthenticatedGuard)
  async onHelp(
    @Ctx() ctx: TelegrafContext,
    @User() user: UserEntity,
    @Chat() chat: TelegrafChat, // Chat ni olish
  ) {
    const telegramMessage = ctx.message as TelegrafMessage;
    if (!telegramMessage) {
      this.logger.warn('Telegram message is undefined in onHelp');
      return;
    }

    try {
      const { userChatRole, isNewUser, isNewChatRole } =
        await this.userManagementService.findOrCreateUserWithDefaultRoleInChat(
          user,
          chat,
        );
      if (isNewUser) {
        this.logger.log(`New user ${user.telegramId} processed in onHelp.`);
      }
      if (isNewChatRole) {
        this.logger.log(
          `New chat role ${userChatRole.role} assigned to user ${user.telegramId} in chat ${chat.id}.`,
        );
      }

      // Log incoming /help command
      await this.messageLoggingService.logMessage(
        telegramMessage,
        user,
        chat,
        MessageDirection.INCOMING,
        userChatRole.role, // Added senderRoleAtMoment
      );

      const helpText =
        'This is the help message. Available commands:\n/start - Start the bot\n/help - Show this help message\n/assign_role <username_or_id> <role> - Assign role (ADMIN only)';

      // Log the incoming /help command
      if (ctx.message && chat) {
        await this.messageLoggingService.logMessage(
          ctx.message as TelegrafMessage,
          user,
          chat,
          MessageDirection.INCOMING,
          userChatRole.role, // Added senderRoleAtMoment
        );
      }

      const sentMessage = await ctx.reply(helpText);
      if (sentMessage && chat) {
        // chat mavjudligini tekshirish
        try {
          const botUser = await this.userManagementService.getBotUserEntity();
          await this.messageLoggingService.logMessage(
            sentMessage,
            botUser,
            chat,
            MessageDirection.OUTGOING,
            UserRole.BOT, // Added senderRoleAtMoment
          );
        } catch (logError) {
          this.logger.error(
            `Failed to log outgoing message in onHelp: ${logError.message}`,
            logError.stack,
          );
        }
      }
    } catch (error) {
      const err = error as TelegramError;
      this.logger.error(
        `Error in onHelp for user ${user.telegramId}: ${err.message}`,
        err.stack,
      );
      const replyText =
        'Xatolik yuz berdi. Iltimos, keyinroq qayta urinib koʻring.';
      const sentReply = await ctx.reply(replyText);
      if (sentReply && chat) {
        // chat mavjudligini tekshirish
        try {
          const botUser = await this.userManagementService.getBotUserEntity();
          await this.messageLoggingService.logMessage(
            sentReply,
            botUser,
            chat,
            MessageDirection.OUTGOING,
            UserRole.BOT, // Added senderRoleAtMoment
          );
        } catch (logError) {
          this.logger.error(
            `Failed to log outgoing error reply in onHelp: ${logError.message}`,
            logError.stack,
          );
        }
      }
    }
  }

  @Command('assign_role')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async assignRole(
    @Ctx() ctx: TelegrafContext,
    @User() assigner: UserEntity,
    @Chat() chat: TelegrafChat,
  ): Promise<void> {
    const telegramMessage = ctx.message as TelegrafMessage;
    if (!telegramMessage || !('text' in telegramMessage)) {
      this.logger.warn('Telegram message or text is undefined in assignRole');
      await ctx.reply("Xatolik: Buyruq formati noto'g'ri.");
      return;
    }

    try {
      const { userChatRole: assignerUserChatRole } =
        await this.userManagementService.findOrCreateUserWithDefaultRoleInChat(
          assigner,
          chat,
        );

      // Log incoming /assign_role command
      await this.messageLoggingService.logMessage(
        telegramMessage,
        assigner,
        chat,
        MessageDirection.INCOMING,
        assignerUserChatRole.role, // Added senderRoleAtMoment
      );

      const parts = telegramMessage.text.split(' ');
      if (parts.length < 3) {
        const replyText =
          "Noto'g'ri format. Foydalanish: /assign_role <foydalanuvchi_nomi_yoki_id> <rol>";
        const sentReply = await ctx.reply(replyText);
        if (sentReply) {
          const botUser = await this.userManagementService.getBotUserEntity();
          await this.messageLoggingService.logMessage(
            sentReply,
            botUser,
            chat,
            MessageDirection.OUTGOING,
            UserRole.BOT,
          ); // Added senderRoleAtMoment
        }
        return;
      }

      const targetIdentifier = parts[1];
      const roleName = parts[2].toUpperCase() as UserRole;

      if (!Object.values(UserRole).includes(roleName)) {
        const replyText = `Noto\'g\'ri rol: ${roleName}. Mavjud rollar: ${Object.values(UserRole).join(', ')}`;
        const sentReply = await ctx.reply(replyText);
        if (sentReply) {
          const botUser = await this.userManagementService.getBotUserEntity();
          await this.messageLoggingService.logMessage(
            sentReply,
            botUser,
            chat,
            MessageDirection.OUTGOING,
            UserRole.BOT,
          ); // Added senderRoleAtMoment
        }
        return;
      }

      try {
        const updatedUser = await this.userManagementService.assignRoleToUser(
          targetIdentifier,
          chat.id,
          roleName,
          assigner,
        );
        const replyText = updatedUser
          ? `Foydalanuvchi ${updatedUser.username || updatedUser.firstName} (${updatedUser.telegramId}) uchun ${chat.type} chatida ${roleName} roli muvaffaqiyatli tayinlandi.`
          : `Foydalanuvchi ${targetIdentifier} uchun rol tayinlashda xatolik yoki foydalanuvchi topilmadi.`;

        const sentReply = await ctx.reply(replyText);
        if (sentReply) {
          const botUser = await this.userManagementService.getBotUserEntity();
          await this.messageLoggingService.logMessage(
            sentReply,
            botUser,
            chat,
            MessageDirection.OUTGOING,
            UserRole.BOT,
          ); // Added senderRoleAtMoment
        }
      } catch (error) {
        const err = error as TelegramError;
        this.logger.error(
          `Error assigning role ${roleName} to ${targetIdentifier}: ${err.message}`,
          err.stack,
        );
        const replyText = `Rol tayinlashda xatolik: ${err.message}`;
        const sentReply = await ctx.reply(replyText);
        if (sentReply) {
          try {
            const botUser = await this.userManagementService.getBotUserEntity();
            await this.messageLoggingService.logMessage(
              sentReply,
              botUser,
              chat,
              MessageDirection.OUTGOING,
              UserRole.BOT,
            ); // Added senderRoleAtMoment
          } catch (logError) {
            this.logger.error(
              `Failed to log outgoing error reply in assignRole: ${logError.message}`,
              logError.stack,
            );
          }
        }
      }
    } catch (error) {
      const err = error as TelegramError;
      this.logger.error(
        `Error in assignRole for user ${assigner.telegramId}: ${err.message}`,
        err.stack,
      );
      const replyText = `Xatolik yuz berdi: ${err.message}`;
      const sentReply = await ctx.reply(replyText);
      if (sentReply) {
        try {
          const botUser = await this.userManagementService.getBotUserEntity();
          await this.messageLoggingService.logMessage(
            sentReply,
            botUser,
            chat,
            MessageDirection.OUTGOING,
            UserRole.BOT,
          ); // Added senderRoleAtMoment
        } catch (logError) {
          this.logger.error(
            `Failed to log outgoing error reply in assignRole: ${logError.message}`,
            logError.stack,
          );
        }
      }
    }
  }

  @Command('create_kpi')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async onCreateKpi(
    @Ctx() ctx: TelegrafContext,
    @Message('text') messageText: string,
    @User() adminUser: UserEntity,
    @Chat() chat: TelegrafChat,
  ) {
    const telegramMessage = ctx.message as TelegrafMessage;
    if (!telegramMessage) {
      this.logger.warn('Telegram message is undefined in onCreateKpi');
      return;
    }

    try {
      const { userChatRole: adminUserChatRole } =
        await this.userManagementService.findOrCreateUserWithDefaultRoleInChat(
          adminUser,
          chat,
        );

      // Log incoming /create_kpi command
      await this.messageLoggingService.logMessage(
        telegramMessage,
        adminUser,
        chat,
        MessageDirection.INCOMING,
        adminUserChatRole.role, // Added senderRoleAtMoment
      );

      const commandParts = messageText.split(' ');
      const kpiArgs = commandParts.slice(1); // Remove /create_kpi part

      if (kpiArgs.length < 3 || kpiArgs.length > 4) {
        const replyText =
          "Noto'g'ri format. Foydalanish: /create_kpi <nomi> <metrika_nomi> <metrika_birligi> [tavsifi]";
        const sentReply = await ctx.reply(replyText);
        if (sentReply) {
          try {
            const botUser = await this.userManagementService.getBotUserEntity();
            await this.messageLoggingService.logMessage(
              sentReply,
              botUser,
              chat,
              MessageDirection.OUTGOING,
              UserRole.BOT,
            ); // Added senderRoleAtMoment
          } catch (logError) {
            this.logger.error(
              `Failed to log outgoing reply in onCreateKpi (usage): ${logError.message}`,
              logError.stack,
            );
          }
        }
        return;
      }

      const [name, metricName, metricUnit, description] = kpiArgs;

      try {
        const createDto: CreateKpiDefinitionDto = {
          name,
          metricName,
          metricUnit,
          description: description || undefined,
        };

        const newKpi = await this.kpiDefinitionService.createKpiDefinition(
          createDto,
          adminUser,
        );
        const replyText = `KPI "${newKpi.name}" (ID: ${newKpi.id}) muvaffaqiyatli yaratildi va tasdiqlanishi kutilmoqda.`;
        const sentReply = await ctx.reply(replyText);
        if (sentReply) {
          try {
            const botUser = await this.userManagementService.getBotUserEntity();
            await this.messageLoggingService.logMessage(
              sentReply,
              botUser,
              chat,
              MessageDirection.OUTGOING,
              UserRole.BOT,
            ); // Added senderRoleAtMoment
          } catch (logError) {
            this.logger.error(
              `Failed to log outgoing reply in onCreateKpi (success): ${logError.message}`,
              logError.stack,
            );
          }
        }
      } catch (error) {
        const err = error as TelegramError;
        this.logger.error(`Error creating KPI: ${err.message}`, err.stack);
        const replyText = `KPI yaratishda xatolik: ${err.message}`;
        const sentReply = await ctx.reply(replyText);
        if (sentReply) {
          try {
            const botUser = await this.userManagementService.getBotUserEntity();
            await this.messageLoggingService.logMessage(
              sentReply,
              botUser,
              chat,
              MessageDirection.OUTGOING,
              UserRole.BOT,
            ); // Added senderRoleAtMoment
          } catch (logError) {
            this.logger.error(
              `Failed to log outgoing error reply in onCreateKpi (catch): ${logError.message}`,
              logError.stack,
            );
          }
        }
      }
    } catch (error) {
      // Outer catch for findOrCreateUserWithDefaultRoleInChat or initial logging
      const err = error as TelegramError;
      this.logger.error(
        `Critical error in onCreateKpi setup: ${err.message}`,
        err.stack,
      );
      const replyText =
        "KPI yaratish buyrug'ini qayta ishlashda tizimli xatolik.";
      const sentReply = await ctx.reply(replyText);
      if (sentReply) {
        try {
          const botUser = await this.userManagementService.getBotUserEntity();
          await this.messageLoggingService.logMessage(
            sentReply,
            botUser,
            chat,
            MessageDirection.OUTGOING,
            UserRole.BOT,
          ); // Added senderRoleAtMoment
        } catch (logError) {
          this.logger.error(
            `Failed to log outgoing critical error reply in onCreateKpi: ${logError.message}`,
            logError.stack,
          );
        }
      }
    }
  }

  // @On('message')
  // @UseGuards(AuthenticatedGuard)
  // async onMessage(
  //   @Ctx() ctx: TelegrafContext,
  //   @User() user: UserEntity,
  // ): Promise<void> {
  //   const message = ctx.message as TelegrafMessage; // Type assertion
  //   const sender = ctx.from; // Bu Telegraf User
  //   const chat = ctx.chat;

  //   if (!sender || !chat || !message) {
  //     this.logger.warn('Sender, chat or message is undefined in onMessage');
  //     return;
  //   }

  //   // Ensure user and their role in this chat are known first
  //   try {
  //     const { userChatRole, isNewUser, isNewChatRole } = await this.userManagementService.findOrCreateUserWithDefaultRoleInChat(user, chat);

  //     if (isNewUser) {
  //       this.logger.log(`New user ${user.telegramId} processed in onMessage.`);
  //     }
  //     if (isNewChatRole) {
  //       this.logger.log(`New chat role ${userChatRole.role} assigned to user ${user.telegramId} in chat ${chat.id}.`);
  //     }

  //     // Log the incoming message to the database
  //     await this.messageLoggingService.logMessage(
  //       message,
  //       user,
  //       chat,
  //       MessageDirection.INCOMING,
  //       userChatRole.role, // Added senderRoleAtMoment
  //     );

  //     // Original console logging (can be kept or removed)
  //     if ('text' in message) {
  //       this.logger.log(
  //         `[DB Logged] Received text message from ${sender.id} in chat ${chat.id}: ${message.text}`,
  //       );
  //     } else {
  //       const messageType = Object.keys(message).find(key => !['message_id', 'date', 'chat', 'from', 'reply_to_message'].includes(key));
  //       this.logger.log(
  //         `[DB Logged] Received ${messageType || 'unknown type'} message from ${sender.id} in chat ${chat.id}`
  //       );
  //     }

  //   } catch (error) {
  //     const err = error as TelegramError;
  //     this.logger.error(
  //       `Error in onMessage for user ${user.telegramId} in chat ${chat.id}: ${err.message}`,
  //       err.stack,
  //     );
  //     // Decide if a reply to the user is needed for this kind of error
  //   }
  // }

  @On('voice')
  async onVoice(
    @Ctx() ctx: TelegrafContext,
    @User() user: UserEntity,
    @Chat() chat: TelegrafChat,
  ): Promise<void> {
    const message = ctx.message as TelegrafMessage.VoiceMessage;

    if (!message || !message.voice) {
      this.logger.warn('Voice message is undefined in onVoice');
      return;
    }

    this.logger.log(
      `Received voice message from TGID: ${user.telegramId} in chat ${chat.id}. Duration: ${message.voice.duration}s, File ID: ${message.voice.file_id}`,
    );

    const { userChatRole } =
      await this.userManagementService.findOrCreateUserWithDefaultRoleInChat(
        user,
        chat,
      );

    if (userChatRole) {
      const loggedMessage = await this.messageLoggingService.logMessage(
        message,
        user,
        chat,
        MessageDirection.INCOMING,
        userChatRole.role,
        undefined, // explicitTextContent - voice messages usually don't have it initially
        false, // isQuestionOverride
        'VOICE', // attachmentType
      );

      if (loggedMessage) {
        this.logger.log(
          `Voice message (Log ID: ${loggedMessage.id}) logged with PENDING STT status.`,
        );
        try {
          await this.aiQueueService.addSttJob({
            audioFileId: message.voice.file_id,
            messageLogId: loggedMessage.id,
            chatId: chat.id,
            telegramUserId: user.telegramId,
          });
        } catch (error) {
          this.logger.error(
            `Failed to add STT job for messageLogId ${loggedMessage.id}: ${error.message}`,
            error.stack,
          );
          // Agar navbatga qo'shishda xatolik bo'lsa, message_log dagi stt_status ni 'FAILED' qilishimiz mumkin
          await this.messageLoggingService.updateMessageLogSttStatus(
            loggedMessage.id,
            SttStatusEnum.FAILED_QUEUE,
          ); // Enum ishlatildi
        }
      } else {
        this.logger.error('Failed to log voice message.');
      }
    } else {
      this.logger.error(
        `Failed to get or create user/role for TGID: ${user.telegramId} in chat ${chat.id} for voice message`,
      );
    }
  }

  @On('text')
  async onTextMessage(
    @Ctx() ctx: TelegrafContext,
    @User() user: UserEntity,
    @Chat() chat: TelegrafChat,
    @Message('text') text: string,
  ): Promise<void> {
    try {
      // Skip commands
      if (text.startsWith('/')) {
        return;
      }

      // Get user's role in chat
      const userChatRole = await this.userManagementService.getUserRoleInChat(
        user,
        chat.id,
      );

      // Log the message
      await this.messageLoggingService.logMessage(
        ctx.message as TelegrafMessage,
        user,
        chat,
        MessageDirection.INCOMING,
        userChatRole,
      );

      // If it's a group chat and user is not admin/supervisor/nazoratchi, treat as a question
      if (
        chat.type !== 'private' &&
        userChatRole !== UserRole.ADMIN &&
        userChatRole !== UserRole.SUPERVISOR
      ) {
        await this.questionMonitoringService.processNewQuestion(
          text,
          chat.id,
          new Date(),
        );
      }

      // If it's a reply to a message, check if it's an answer to a pending question
      const message = ctx.message as any; // Type assertion for now
      if (
        message.reply_to_message &&
        typeof message.reply_to_message === 'object' &&
        'text' in message.reply_to_message
      ) {
        await this.questionMonitoringService.handleResponse(
          message.reply_to_message.text,
          user,
          chat.id,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing text message: ${error.message}`,
        error.stack,
      );
    }
  }
}