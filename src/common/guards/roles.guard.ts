import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserManagementService } from '../../features/user-management/user-management.service';
import { UserEntity } from '../../features/user-management/entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { Context } from 'telegraf';


@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private userManagementService: UserManagementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const tgContext = TelegrafExecutionContext.create(context);
    const ctx = tgContext.getContext<Context & { session?: { userEntity?: UserEntity } }>();
    const chat = ctx.chat;
    let userEntity = ctx.session?.userEntity;

    // 1. Foydalanuvchini topish yoki yaratish
    if (!userEntity) {
      const telegramUser = ctx.from;
      if (!telegramUser) {
        this.logger.warn('RolesGuard: Telegram foydalanuvchi aniqlanmadi.');
        throw new ForbiddenException('Foydalanuvchi aniqlanmadi.');
      }
      userEntity = await this.userManagementService.getUserByTelegramId(telegramUser.id)||undefined;
      if (!userEntity) {
        userEntity = await this.userManagementService.registerUser({
          telegramId: telegramUser.id,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          username: telegramUser.username,
        });
        this.logger.log(`Yangi foydalanuvchi yaratildi: ${telegramUser.id}`);
      }
      if (ctx.session) ctx.session.userEntity = userEntity;
    }

    // 2. Chat aniqlanmagan bo‘lsa, xatolik
    if (!chat) {
      this.logger.warn('RolesGuard: Chat aniqlanmadi.');
      throw new ForbiddenException('Chat aniqlanmadi.');
    }

    // 3. Chatda roli yo‘q bo‘lsa, xatolik (avtomatik CLIENT bermaymiz)
    let userRoleInChat = await this.userManagementService.getUserRoleInChat(userEntity, chat.id);
    if (!userRoleInChat) {
      this.logger.warn(
        `RolesGuard: User ${userEntity.telegramId} uchun chat ${chat.id} da rol topilmadi. Access denied.`
      );
      throw new ForbiddenException('Sizga bu chatda rol biriktirilmagan. Iltimos, admin bilan bog‘laning.');
    }

    // 4. Kerakli rolni tekshirish
    const hasRequiredRole = requiredRoles.some((role) => userRoleInChat === role);

    if (!hasRequiredRole) {
      this.logger.warn(
        `RolesGuard: User ${userEntity.telegramId} (role: ${userRoleInChat}) does not have required roles (${requiredRoles.join(', ')}) for chat ${chat.id}. Access denied.`,
      );
      throw new ForbiddenException(
        `Your role (${userRoleInChat}) is not authorized to perform this action.`,
      );
    }

    this.logger.verbose(
      `RolesGuard: User ${userEntity.telegramId} (role: ${userRoleInChat}) has required role for chat ${chat.id}. Access granted.`,
    );
    return true;
  }
}