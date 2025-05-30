import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { UserChatRoleEntity } from './entities/user-chat-role.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { ConfigService } from '@nestjs/config';
import { TelegramBaseService } from '../telegram-base/telegram-base.service';
import { Chat as TelegrafChat } from 'telegraf/types';

interface TelegramError extends Error {
  message: string;
  stack?: string;
}

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);
  private readonly adminTelegramId: number;

  // Bot user constants
  private readonly BOT_TELEGRAM_ID = 1; // Using a fixed ID for the bot
  private readonly BOT_USERNAME = 'FincoBot';
  private readonly BOT_FIRST_NAME = 'Finco';
  private readonly BOT_LAST_NAME = 'Bot';

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserChatRoleEntity)
    private readonly userChatRoleRepository: Repository<UserChatRoleEntity>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => TelegramBaseService))
    private readonly telegramService: TelegramBaseService,
  ) {
    this.adminTelegramId = parseInt(
      this.configService.get<string>('TELEGRAM_ADMIN_TELEGRAM_ID', '0'),
      10,
    );
    if (this.adminTelegramId === 0) {
      this.logger.warn(
        'TELEGRAM_ADMIN_TELEGRAM_ID is not set in .env file. Some admin features might not work.',
      );
    }
  }

  async getUserByTelegramId(telegramId: number): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: { telegramId },
      relations: ['chatRoles'],
    });
  }

  async registerUser(userData: {
    telegramId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<UserEntity> {
    this.logger.log(
      `Registering new user with Telegram ID: ${userData.telegramId}`,
    );
    const existingUser = await this.userRepository.findOne({
      where: { telegramId: userData.telegramId },
    });
    if (existingUser) {
      this.logger.warn(
        `User with Telegram ID ${userData.telegramId} already exists.`,
      );
      existingUser.username = userData.username || existingUser.username;
      return this.userRepository.save(existingUser);
    }

    const newUser = this.userRepository.create({
      telegramId: userData.telegramId,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName,
    });
    return this.userRepository.save(newUser);
  }

  async findOrCreateUserWithDefaultRoleInChat(
    passedUserEntity: UserEntity,
    chat: TelegrafChat,
    defaultRoleIfNotAdmin: UserRole = UserRole.CLIENT,
  ): Promise<{
    user: UserEntity;
    userChatRole: UserChatRoleEntity;
    isNewUser: boolean;
    isNewChatRole: boolean;
  }> {
    const { telegramId, firstName, lastName, username } = passedUserEntity;
    const { id: chatId, type: chatType } = chat;

    this.logger.debug(
      `Finding or creating chat role for user ${telegramId} (ID: ${passedUserEntity.id}) in chat ${chatId}`,
    );

    const user = passedUserEntity;
    const isNewUser = false;

    let userChatRole = await this.userChatRoleRepository.findOne({
      where: { userId: user.id, chatId },
      relations: ['user'],
    });

    let isNewChatRole = false;
    if (!userChatRole) {
      this.logger.log(
        `User ${user.id} role in chat ${chatId} not found, creating new role.`,
      );
      const role =
        user.telegramId === this.adminTelegramId
          ? UserRole.ADMIN
          : defaultRoleIfNotAdmin;
      userChatRole = this.userChatRoleRepository.create({
        userId: user.id,
        chatId,
        role,
        chatType,
        user: user,
      });
      await this.userChatRoleRepository.save(userChatRole);
      isNewChatRole = true;
      this.logger.log(
        `Role ${role} created for user ${user.id} in chat ${chatId}.`,
      );
    } else {
      this.logger.debug(
        `User ${user.id} already has role ${userChatRole.role} in chat ${chatId}.`,
      );
      if (userChatRole.chatType !== chatType) {
        userChatRole.chatType = chatType;
        await this.userChatRoleRepository.save(userChatRole);
        this.logger.log(
          `Chat type updated for user ${user.id} in chat ${chatId} to ${chatType}.`,
        );
      }
      if (!userChatRole.user) {
        userChatRole.user = user;
        await this.userChatRoleRepository.save(userChatRole);
      }
    }

    return { user, userChatRole, isNewUser, isNewChatRole };
  }

  async setChatRole(
    user: UserEntity,
    chatId: number,
    role: UserRole,
    chatType: string,
  ): Promise<UserChatRoleEntity> {
    let userChatRole = await this.userChatRoleRepository.findOne({
      where: { userId: user.id, chatId },
    });

    if (userChatRole) {
      userChatRole.role = role;
      userChatRole.chatType = chatType;
    } else {
      userChatRole = this.userChatRoleRepository.create({
        userId: user.id,
        chatId,
        role,
        chatType,
        user: user,
      });
    }
    return this.userChatRoleRepository.save(userChatRole);
  }

  async assignRoleToUser(
    targetIdentifier: string,
    chatId: number | undefined,
    role: UserRole,
    assigner: UserEntity,
  ): Promise<UserEntity | null> {
    this.logger.log(
      `Attempting to assign role ${role} to user ${targetIdentifier} in chat ${chatId} by ${assigner.telegramId}`,
    );
    if (chatId === undefined) {
      throw new Error(
        'Chat ID must be provided to assign a chat-specific role.',
      );
    }

    let targetUser: UserEntity | null = null;
    if (isNaN(parseInt(targetIdentifier))) {
      targetUser = await this.userRepository.findOne({
        where: { username: targetIdentifier },
      });
    } else {
      targetUser = await this.userRepository.findOne({
        where: { telegramId: parseInt(targetIdentifier) },
      });
    }

    if (!targetUser) {
      throw new NotFoundException(
        `Foydalanuvchi (identifikator: ${targetIdentifier}) topilmadi.`,
      );
    }

    const assignerChatRole = await this.userChatRoleRepository.findOne({
      where: { userId: assigner.id, chatId: chatId },
    });

    // Check if assigner has permission to assign roles
    const canAssignRoles =
      assigner.telegramId === this.adminTelegramId ||
      (assignerChatRole &&
        [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ACCOUNTANT].includes(
          assignerChatRole.role,
        ) &&
        assignerChatRole.chatId === chatId);

    if (!canAssignRoles) {
      this.logger.warn(
        `User ${assigner.telegramId} (Role in chat: ${assignerChatRole?.role}) ` +
          `does not have permission to assign roles in chat ${chatId} or is not global admin.`,
      );
      throw new ForbiddenException("Sizda rol tayinlash uchun ruxsat yo'q.");
    }

    // Only global admin can assign ADMIN role
    if (
      role === UserRole.ADMIN &&
      assigner.telegramId !== this.adminTelegramId
    ) {
      this.logger.warn(
        `User ${assigner.telegramId} attempted to assign ADMIN role to another user. Denied.`,
      );
      throw new ForbiddenException(
        'Faqat bosh administrator boshqa foydalanuvchiga ADMIN rolini tayinlashi mumkin.',
      );
    }

    // Only global admin can modify bot owner's admin status
    if (
      role === UserRole.ADMIN &&
      targetUser.telegramId === this.adminTelegramId &&
      assigner.telegramId !== this.adminTelegramId
    ) {
      this.logger.warn(
        `Attempt to assign ADMIN role to the bot owner (ID: ${this.adminTelegramId}) by ${assigner.telegramId}. Denied.`,
      );
      throw new ForbiddenException(
        'Bot egasiga ADMIN rolini boshqalar tayinlay olmaydi.',
      );
    }

    // Check if assigner has permission to assign the requested role
    if (assignerChatRole && assigner.telegramId !== this.adminTelegramId) {
      const assignerRole = assignerChatRole.role;
      const allowedRolesToAssign = [UserRole.ACCOUNTANT, UserRole.BANK_CLIENT];

      if (
        assignerRole === UserRole.SUPERVISOR ||
        assignerRole === UserRole.ACCOUNTANT
      ) {
        if (!allowedRolesToAssign.includes(role)) {
          this.logger.warn(
            `User ${assigner.telegramId} (${assignerRole}) attempted to assign role ${role} which is not allowed.`,
          );
          throw new ForbiddenException(
            `Siz faqat ${allowedRolesToAssign.join(' yoki ')} rollarini tayinlashingiz mumkin.`,
          );
        }
      }
    }

    let chatType = assignerChatRole?.chatType; // Default to assigner's current chat type
    let chatInfo: Awaited<
      ReturnType<TelegramBaseService['getChatInfo']>
    > | null = null;

    if (!chatType) {
      try {
        chatInfo = await this.telegramService.getChatInfo(chatId);
        chatType = chatInfo.type;
      } catch (e) {
        this.logger.error(
          `Could not fetch chat type for chat ${chatId}, defaulting to 'private'`,
          e,
        );
        chatType = 'private';
      }
    }

    await this.setChatRole(targetUser, chatId, role, chatType);

    try {
      await this.telegramService.sendMessage(
        targetUser.telegramId,
        `Sizga "${chatType === 'private' ? 'shaxsiy' : chatInfo && 'title' in chatInfo && chatInfo.title ? chatInfo.title : chatId}" chatida "${assigner.firstName || assigner.username}" tomonidan "${role}" roli tayinlandi.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to notify user ${targetUser.telegramId} about role assignment: ${error.message}`,
      );
    }
    return this.userRepository.findOne({
      where: { id: targetUser.id },
      relations: ['chatRoles'],
    });
  }

  async getUserRoleInChat(
    user: UserEntity,
    chatId: number,
  ): Promise<UserRole | null> {
    const chatRole = await this.userChatRoleRepository.findOne({
      where: { userId: user.id, chatId },
    });
    return chatRole ? chatRole.role : null;
  }

  private async getChatInfoFromContext(chatId: number): Promise<{
    type: string;
    title?: string;
  }> {
    this.logger.warn(
      `getChatInfoFromContext is a placeholder and needs real implementation for chat ${chatId}`,
    );

    try {
      const chatInfo = await this.telegramService.getChatInfo(chatId);
      return {
        type: chatInfo.type,
        title: 'title' in chatInfo ? chatInfo.title : undefined,
      };
    } catch (error) {
      const err = error as TelegramError;
      this.logger.error(
        `Could not get chat info for ${chatId} in getChatInfoFromContext: ${err.message}`,
      );
      return { type: 'group', title: 'Unknown Group' };
    }
  }

  async isUserAdmin(user: UserEntity, chatId: number): Promise<boolean> {
    const role = await this.getUserRoleInChat(user, chatId);
    return role === UserRole.ADMIN;
  }

  async getBotUserEntity(): Promise<UserEntity> {
    let botUser = await this.userRepository.findOne({
      where: { telegramId: this.BOT_TELEGRAM_ID },
    });

    if (!botUser) {
      this.logger.log(
        `Bot user with Telegram ID ${this.BOT_TELEGRAM_ID} not found, creating new one.`,
      );
      const newBotData: Partial<UserEntity> = {
        telegramId: this.BOT_TELEGRAM_ID,
        username: this.BOT_USERNAME,
        firstName: this.BOT_FIRST_NAME,
        lastName: this.BOT_LAST_NAME,
        // Note: We are not assigning a default UserRole.BOT here directly to UserEntity
        // as roles are managed via UserChatRoleEntity.
        // The UserEntity for the bot primarily serves as an identifier.
      };
      botUser = this.userRepository.create(newBotData);
      await this.userRepository.save(botUser);
      this.logger.log(
        `Bot user ${botUser.username} (ID: ${botUser.id}, TelegramID: ${botUser.telegramId}) created.`,
      );
    }
    return botUser;
  }
}
