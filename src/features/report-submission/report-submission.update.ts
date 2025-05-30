import { Logger } from '@nestjs/common';
import { Update, Ctx, Command, On, Message, Hears } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { ReportSubmissionService } from './report-submission.service';
import { UserManagementService } from '../user-management/user-management.service';
import { Message as TelegrafMessage, Chat } from 'telegraf/types'; // Added Chat

@Update()
export class ReportSubmissionUpdate {
  private readonly logger = new Logger(ReportSubmissionUpdate.name);

  constructor(
    private readonly reportSubmissionService: ReportSubmissionService,
    private readonly userManagementService: UserManagementService,
  ) {}

  @Command('submit_report')
  async onSubmitReportCommand(
    @Ctx() ctx: Context,
    @Message('text') messageText: string,
  ): Promise<void> {
    const telegramUser = ctx.from;
    const chat = ctx.chat; // Get chat from context

    if (!telegramUser || !chat) {
      this.logger.warn(
        'Cannot identify user or chat from context for report submission',
      );
      await ctx.reply(
        'Sizni yoki chatni aniqlay olmadim. Iltimos, qaytadan urinib koʻring.',
      );
      return;
    }

    // 1. Get UserEntity by Telegram ID
    let userEntity = await this.userManagementService.getUserByTelegramId(
      telegramUser.id,
    );
    let isNewUserInSystem = false;

    // 2. If UserEntity not found, register new user
    if (!userEntity) {
      this.logger.log(
        `User with Telegram ID ${telegramUser.id} not found. Registering.`,
      );
      userEntity = await this.userManagementService.registerUser({
        telegramId: telegramUser.id,
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
      });
      isNewUserInSystem = true;
      this.logger.log(
        `User ${userEntity.id} (TG: ${telegramUser.id}) registered.`,
      );
    }

    // 3. Find or create user role in the current chat
    const { user, userChatRole, isNewChatRole } =
      await this.userManagementService.findOrCreateUserWithDefaultRoleInChat(
        userEntity, // Pass the fetched or newly created userEntity
        chat, // Pass the chat context
      );

    if (!user || !userChatRole) {
      this.logger.error(
        `Failed to get user or userChatRole for TGID: ${telegramUser.id} in chat ${chat.id}`,
      );
      await ctx.reply(
        'Foydalanuvchi maʼlumotlarini yoki chatdagi rolni olib boʻlmadi.',
      );
      return;
    }

    this.logger.log(
      `User ${user.id} (TG: ${user.telegramId}), Role in chat ${chat.id}: ${userChatRole.role}. New user in system: ${isNewUserInSystem}, New chat role: ${isNewChatRole}`,
    );

    const currentMessage = ctx.message as
      | TelegrafMessage.DocumentMessage
      | TelegrafMessage.TextMessage
      | undefined;
    const document =
      currentMessage && 'document' in currentMessage
        ? currentMessage.document
        : undefined;

    const parts = messageText.split(' ');
    const reportCode = parts.length > 1 ? parts[1] : undefined;

    if (!reportCode && !document) {
      await ctx.reply(
        'Hisobot kodini kiriting yoki fayl yuklang. Masalan: /submit_report OYLIK_XARAJATLAR',
      );
      return;
    }
    if (!reportCode && document) {
      this.logger.warn(
        'File uploaded with /submit_report command but without report code. This scenario needs clarification.',
      );
      await ctx.reply(
        'Fayl bilan hisobot kodini ham kiriting. Masalan: /submit_report OYLIK_XARAJATLAR [faylni biriktiring]',
      );
      return;
    }

    this.logger.log(
      `Received /submit_report command with code '${reportCode}' from user ${user.telegramId}, document attached: ${!!document}`,
    );

    if (!currentMessage) {
      this.logger.error('Message object is undefined in submit_report');
      await ctx.reply('Xabar topilmadi.');
      return;
    }

    try {
      const reportSubmission =
        await this.reportSubmissionService.handleReportSubmission(
          user,
          chat as Chat.PrivateChat | Chat.GroupChat | Chat.SupergroupChat, // Type assertion for chat
          currentMessage, // Pass the asserted message object
          userChatRole.role, // userRoleInChat (required)
          reportCode, // reportCode (optional)
        );

      if (reportSubmission && reportSubmission.reportType) {
        await ctx.reply(
          `Hisobot (${reportSubmission.reportType.name}) kodi '${reportCode}' bilan muvaffaqiyatli qabul qilindi. Status: ${reportSubmission.status}. ID: ${reportSubmission.id}`,
        );
      } else if (reportSubmission) {
        await ctx.reply(
          `Hisobot (ID: ${reportSubmission.id}) kodi '${reportCode}' bilan muvaffaqiyatli qabul qilindi. Status: ${reportSubmission.status}. Hisobot turi nomi topilmadi. Administratorga murojaat qiling. `,
        );
      } else {
        await ctx.reply(
          `Hisobotni (${reportCode}) qayd etishda muammo yuz berdi. Mumkin sabablar: hisobot kodi noto'g'ri, sizda ruxsat yo'q yoki fayl biriktirilmagan bo'lishi mumkin. Iltimos, ma'lumotlarni tekshirib, qaytadan urinib ko'ring yoki administratorga murojaat qiling.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing /submit_report command with code ${reportCode}: ${error.message}`,
        error.stack,
      );
      await ctx.reply('Hisobotni qayta ishlashda kutilmagan server xatoligi.');
    }
  }

  @On('document')
  async onDocument(@Ctx() ctx: Context): Promise<void> {
    // Changed ctx type
    const telegramUser = ctx.from;
    const chat = ctx.chat; // Get chat from context

    if (!telegramUser || !chat) {
      this.logger.warn(
        'Cannot identify user or chat from context for report submission',
      );
      return;
    }

    // 1. Get UserEntity by Telegram ID
    let userEntity = await this.userManagementService.getUserByTelegramId(
      telegramUser.id,
    );
    let isNewUserInSystem = false;

    // 2. If UserEntity not found, register new user
    if (!userEntity) {
      this.logger.log(
        `User with Telegram ID ${telegramUser.id} not found. Registering.`,
      );
      userEntity = await this.userManagementService.registerUser({
        telegramId: telegramUser.id,
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
      });
      isNewUserInSystem = true;
      this.logger.log(
        `User ${userEntity.id} (TG: ${telegramUser.id}) registered.`,
      );
    }

    // 3. Find or create user role in the current chat
    const { user, userChatRole, isNewChatRole } =
      await this.userManagementService.findOrCreateUserWithDefaultRoleInChat(
        userEntity, // Pass the fetched or newly created userEntity
        chat, // Pass the chat context
      );

    if (!user || !userChatRole) {
      this.logger.error(
        `Failed to get user or userChatRole for TGID: ${telegramUser.id} in chat ${chat.id}`,
      );
      return;
    }

    this.logger.log(
      `User ${user.id} (TG: ${user.telegramId}), Role in chat ${chat.id}: ${userChatRole.role}. New user in system: ${isNewUserInSystem}, New chat role: ${isNewChatRole}`,
    );

    const currentMessage = ctx.message as
      | TelegrafMessage.DocumentMessage
      | undefined;
    if (!currentMessage || !('document' in currentMessage)) {
      this.logger.warn(
        'Document message not found in context on document upload',
      );
      return;
    }

    const caption = currentMessage.caption;
    let reportCodeFromCaption: string | undefined = undefined;

    if (caption) {
      const match =
        caption.match(/#report\s+([\w-]+)/i) ||
        caption.match(/report_code:\s*([\w-]+)/i);
      if (match && match[1]) {
        reportCodeFromCaption = match[1];
        this.logger.log(
          `Extracted report code '${reportCodeFromCaption}' from document caption.`,
        );
      }
    }

    if (!reportCodeFromCaption) {
      this.logger.log(
        `Document received from user ${telegramUser.id} without explicit report code in command or caption. Document: ${currentMessage.document?.file_name}. Ignoring for now or applying default logic.`,
      );
      return;
    }

    this.logger.log(
      `Document received with inferred report code '${reportCodeFromCaption}' from user ${user.telegramId} (Role: ${userChatRole.role})`,
    );

    try {
      const reportSubmission =
        await this.reportSubmissionService.handleReportSubmission(
          user,
          chat as Chat.PrivateChat | Chat.GroupChat | Chat.SupergroupChat, // Type assertion for chat
          currentMessage, // Pass the asserted message object
          userChatRole.role, // userRoleInChat (required)
          reportCodeFromCaption, // reportCode (optional)
        );

      if (reportSubmission && reportSubmission.reportType) {
        await ctx.reply(
          `Fayl (${currentMessage.document?.file_name}) hisobot (${reportSubmission.reportType.name}) sifatida muvaffaqiyatli qabul qilindi. Status: ${reportSubmission.status}. ID: ${reportSubmission.id}`,
        );
      } else if (reportSubmission) {
        // Agar reportType bo'lmasa (bu holat bo'lmasligi kerak)
        await ctx.reply(
          `Fayl (${currentMessage.document?.file_name}) hisobot (ID: ${reportSubmission.id}) sifatida muvaffaqiyatli qabul qilindi. Status: ${reportSubmission.status}. Hisobot turi nomi topilmadi. Administratorga murojaat qiling.`,
        );
      } else {
        // Servis null qaytargan holat
        await ctx.reply(
          `Faylni (${currentMessage.document?.file_name}) hisobot (${reportCodeFromCaption}) sifatida qayd etishda muammo yuz berdi. Mumkin sabablar: hisobot kodi noto'g'ri (fayl sarlavhasida ko'rsatilgan), sizda ruxsat yo'q yoki boshqa muammo. Iltimos, ma'lumotlarni tekshirib, qaytadan urinib ko'ring yoki administratorga murojaat qiling.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing document with inferred code ${reportCodeFromCaption}: ${error.message}`,
        error.stack,
      );
      await ctx.reply(
        'Faylni hisobot sifatida qayta ishlashda kutilmagan server xatoligi.',
      );
    }
  }
}
