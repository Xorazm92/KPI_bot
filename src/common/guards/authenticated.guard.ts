import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Context } from 'telegraf';
import { UserEntity } from '../../features/user-management/entities/user.entity';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  private readonly logger = new Logger(AuthenticatedGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest();

    // Check if it's a Telegraf context
    const telegrafCtx = context.getArgByIndex<Context & { session?: { userEntity?: UserEntity } }>(0);

    if (telegrafCtx && telegrafCtx.session) {
      const userInSession = telegrafCtx.session.userEntity;
      if (userInSession) {
        this.logger.debug(`User ${userInSession.telegramId} is authenticated via session.`);
        return true;
      }
    }

    // If not a Telegraf context or no user in session, check HTTP request (if applicable)
    // This part might be more relevant for a web interface, not a Telegram bot
    if (request && request.isAuthenticated && request.isAuthenticated()) {
      this.logger.debug('User is authenticated via HTTP session (e.g., web).');
      return true;
    }

    this.logger.warn('User is not authenticated.');
    if (telegrafCtx) {
      // Optionally, send a message to the user if it's a Telegraf context
      // await telegrafCtx.reply('You need to be logged in to use this command. Try /login.');
    }
    return false;
  }
}
