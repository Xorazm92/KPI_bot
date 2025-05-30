import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserManagementService } from '../../features/user-management/user-management.service'; // Updated import
import { UserEntity } from '../../features/user-management/entities/user.entity'; // Import UserEntity
import { UserRole } from '../enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { Context } from 'telegraf'; // Import Telegraf Context

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private userManagementService: UserManagementService, // Updated injection
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles specified, access granted
    }

    const tgContext = TelegrafExecutionContext.create(context);
    const ctx = tgContext.getContext<
      Context & { session?: { userEntity?: UserEntity } }
    >(); // Session type ni kengaytirish
    const chat = ctx.chat;

    // Sessiyadan UserEntity ni olish
    const userEntity = ctx.session?.userEntity;

    if (!userEntity || !chat) {
      this.logger.warn(
        'RolesGuard: Could not extract UserEntity from session or chat from Telegraf context.',
      );
      throw new ForbiddenException(
        'User or chat information is missing or user not authenticated.',
      );
    }

    const userRoleInChat = await this.userManagementService.getUserRoleInChat(
      userEntity,
      chat.id,
    );

    if (!userRoleInChat) {
      this.logger.warn(
        `RolesGuard: User ${userEntity.telegramId} has no role in chat ${chat.id}. Access denied.`,
      );
      // Optionally, reply to the user if appropriate, though guards usually just throw
      // ctx.reply('Sizda bu amalni bajarish uchun ruxsat yo\'q (rol topilmadi).');
      throw new ForbiddenException(
        'You do not have a role assigned in this chat.',
      );
    }

    const hasRequiredRole = requiredRoles.some(
      (role) => userRoleInChat === role,
    );

    if (!hasRequiredRole) {
      this.logger.warn(
        `RolesGuard: User ${userEntity.telegramId} (role: ${userRoleInChat}) does not have required roles (${requiredRoles.join(', ')}) for chat ${chat.id}. Access denied.`,
      );
      // ctx.reply(`Sizda bu amalni bajarish uchun kerakli ruxsat (${requiredRoles.join(', ')}) yo\'q. Sizning rolingiz: ${userRoleInChat}.`);
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
