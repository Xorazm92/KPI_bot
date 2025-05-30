import { Logger } from '@nestjs/common';
import { Update, Ctx, Command, Message } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { AttendanceService } from './attendance.service';
import { UserManagementService } from '../user-management/user-management.service';
import { AttendanceStatus } from './entities/attendance-log.entity';
import { UserRole } from '../../common/enums/user-role.enum';

@Update()
export class AttendanceUpdate {
  private readonly logger = new Logger(AttendanceUpdate.name);

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly userManagementService: UserManagementService,
  ) {}

  private async handleAttendanceCommand(
    ctx: Context,
    messageText: string,
    action: 'checkin' | 'checkout',
  ): Promise<void> {
    const telegramUser = ctx.from;
    if (!telegramUser) {
      this.logger.warn('Cannot identify user from context');
      await ctx.reply('Sizni aniqlay olmadim.');
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
        `User with Telegram ID ${telegramUser.id} not found for attendance. Registering.`,
      );
      userEntity = await this.userManagementService.registerUser({
        telegramId: telegramUser.id,
        username: telegramUser.username,
        firstName: telegramUser.first_name, // Use snake_case from TelegrafUser
        lastName: telegramUser.last_name, // Use snake_case from TelegrafUser
      });
      isNewUserInSystem = true;
      this.logger.log(
        `User ${userEntity.id} (TG: ${telegramUser.id}) registered for attendance.`,
      );
    }

    // 3. Find or create user role in the current chat
    const { user, userChatRole, isNewChatRole } =
      await this.userManagementService.findOrCreateUserWithDefaultRoleInChat(
        userEntity,
        ctx.chat!, // Assert chat is not null/undefined here
      );

    if (!user || !userChatRole) {
      this.logger.error(
        `Failed to get user or userChatRole for TGID: ${telegramUser.id} in chat ${ctx.chat!.id} for attendance.`,
      );
      await ctx.reply(
        'Foydalanuvchi maʼlumotlarini yoki chatdagi rolni olib boʻlmadi.',
      );
      return;
    }

    this.logger.log(
      `Attendance command from User ${user.id} (TG: ${user.telegramId}), Role in chat ${ctx.chat!.id}: ${userChatRole.role}. New user: ${isNewUserInSystem}, New chat role: ${isNewChatRole}`,
    );

    // Check if user is an agent in this chat
    if (userChatRole.role !== UserRole.AGENT) {
      this.logger.warn(
        `User ${user.telegramId} (Role: ${userChatRole.role}) in chat ${ctx.chat!.id} tried to use /attendance but is not an AGENT.`,
      );
      await ctx.reply('Bu buyruq faqat agentlar uchun.');
      return;
    }

    const notes = messageText.split(' ').slice(1).join(' ').trim() || undefined;
    this.logger.log(
      `User ${user.telegramId} attempting ${action} with notes: '${notes || ''}'`,
    );

    try {
      let result;
      if (action === 'checkin') {
        result = await this.attendanceService.checkIn(user, notes);
        await ctx.reply(
          `Siz muvaffaqiyatli ishga keldingiz (check-in)! Vaqt: ${result.checkInTime?.toLocaleTimeString('uz-UZ')}. ${notes ? 'Izoh: ' + notes : ''}`,
        );
      } else {
        result = await this.attendanceService.checkOut(user, notes);
        await ctx.reply(
          `Siz muvaffaqiyatli ishdan ketdingiz (check-out)! Vaqt: ${result.checkOutTime?.toLocaleTimeString('uz-UZ')}. Ishlagan vaqtingiz: ${result.durationMinutes} daqiqa. ${notes ? 'Izoh: ' + notes : ''}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Error during ${action} for user ${user.telegramId}: ${error.message}`,
      );
      await ctx.reply(
        error.message || `Amaliyotni (${action}) bajarishda xatolik yuz berdi.`,
      );
    }
  }

  @Command('checkin')
  async onCheckInCommand(
    @Ctx() ctx: Context,
    @Message('text') messageText: string,
  ): Promise<void> {
    await this.handleAttendanceCommand(ctx, messageText, 'checkin');
  }

  @Command('in') // Qisqa buyruq
  async onInCommand(
    @Ctx() ctx: Context,
    @Message('text') messageText: string,
  ): Promise<void> {
    await this.handleAttendanceCommand(ctx, messageText, 'checkin');
  }

  @Command('checkout')
  async onCheckOutCommand(
    @Ctx() ctx: Context,
    @Message('text') messageText: string,
  ): Promise<void> {
    await this.handleAttendanceCommand(ctx, messageText, 'checkout');
  }

  @Command('out') // Qisqa buyruq
  async onOutCommand(
    @Ctx() ctx: Context,
    @Message('text') messageText: string,
  ): Promise<void> {
    await this.handleAttendanceCommand(ctx, messageText, 'checkout');
  }
}
