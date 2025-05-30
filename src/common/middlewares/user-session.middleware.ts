import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Context as TelegrafContext } from 'telegraf';
import { UserManagementService } from '../../features/user-management/user-management.service';
import { UserEntity } from '../../features/user-management/entities/user.entity';

interface TelegrafContextWithSession extends TelegrafContext {
  session?: {
    userEntity?: UserEntity;
    [key: string]: any; // Allow other session properties
  };
}

@Injectable()
export class UserSessionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(UserSessionMiddleware.name);

  constructor(private readonly userManagementService: UserManagementService) {}

  async use(ctx: TelegrafContextWithSession, next: (error?: any) => void) {
    if (!ctx.from) {
      this.logger.debug(
        'No sender (ctx.from) in Telegraf context. Skipping user session setup.',
      );
      return next();
    }

    if (!ctx.session) {
      this.logger.warn(
        'ctx.session is not available. Ensure TelegrafSessionLocal middleware is applied before UserSessionMiddleware.',
      );
      return next(); // Or throw an error if session is strictly required
    }

    // If userEntity is already in session and is a valid instance, skip fetching
    if (
      ctx.session.userEntity &&
      ctx.session.userEntity instanceof UserEntity &&
      ctx.session.userEntity.telegramId === ctx.from.id
    ) {
      this.logger.debug(`User ${ctx.from.id} already found in session.`);
      return next();
    }

    try {
      const telegrafUser = ctx.from;
      const telegrafChat = ctx.chat; // Chat can be undefined for some updates (e.g., inline queries)

      let user = await this.userManagementService.getUserByTelegramId(
        telegrafUser.id,
      );
      if (!user) {
        user = await this.userManagementService.registerUser({
          telegramId: telegrafUser.id,
          username: telegrafUser.username,
          firstName: telegrafUser.first_name,
          lastName: telegrafUser.last_name,
        });
        this.logger.log(
          `New user ${user.telegramId} registered and added to session.`,
        );
      } else {
        this.logger.debug(
          `User ${user.telegramId} found in DB and added/updated in session.`,
        );
      }

      ctx.session.userEntity = user;

      if (telegrafChat && user) {
        await this.userManagementService.findOrCreateUserWithDefaultRoleInChat(
          user,
          telegrafChat,
        );
        this.logger.debug(
          `UserChatRole ensured for user ${user.telegramId} in chat ${telegrafChat.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Error in UserSessionMiddleware while fetching or creating user:',
        error,
      );
    }

    next();
  }
}
