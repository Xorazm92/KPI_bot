import {
  createParamDecorator,
  ExecutionContext,
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Context as TelegrafContext } from 'telegraf';
import { UserEntity } from '../../features/user-management/entities/user.entity';

export const User = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext): Promise<UserEntity> => {
    const logger = new Logger('UserDecorator');
    const telegrafContext = ctx.getArgByIndex<
      TelegrafContext & { session?: { userEntity?: UserEntity } }
    >(0);

    if (!telegrafContext) {
      logger.error('Telegraf context is missing in UserDecorator.');
      throw new InternalServerErrorException('Telegraf context not found.');
    }

    // Assuming userEntity is stored in session by AuthenticatedGuard or a login process
    const userEntity: any = telegrafContext.session?.userEntity;

    if (!userEntity) {
      logger.warn(
        'UserEntity not found in session. User might not be authenticated or session is not properly set.',
      );
      // Depending on strictness, you might throw UnauthorizedException or allow null/undefined
      // For now, let's throw if user is expected to be authenticated by a guard before this decorator is used.
      throw new UnauthorizedException(
        'User not authenticated or session missing user data.',
      );
    }

    // Ensure it's an instance of UserEntity, if not, hydrate from DB
    if (!(userEntity instanceof UserEntity)) {
      logger.warn('Session userEntity is a plain object, hydrating from DB...');
      // Try to get the userId (could be id or telegramId)
      const userId = (userEntity as any).id || (userEntity as any).telegramId;
      if (!userId) {
        logger.error('Session user data has no id or telegramId:', userEntity);
        throw new InternalServerErrorException('Session user data missing id.');
      }
      // Dynamically import the repository (to avoid circular dep)
      const req = ctx.switchToHttp?.()?.getRequest?.() || {};
      const userRepository = req.userRepository || req.app?.get?.('UserEntityRepository');
      if (!userRepository || typeof userRepository.findOne !== 'function') {
        logger.error('UserRepository not found in request context.');
        throw new InternalServerErrorException('UserRepository not available.');
      }
      const hydrated = await userRepository.findOne({ where: { id: userId } });
      if (!hydrated) {
        logger.error('User not found in DB for session user:', userEntity);
        throw new InternalServerErrorException('Session user not found in DB.');
      }
      // Optionally update session
      if (telegrafContext.session) {
        telegrafContext.session.userEntity = hydrated;
      }
      return hydrated;
    }

    return userEntity;
  },
);
