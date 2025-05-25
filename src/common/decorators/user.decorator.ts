import { createParamDecorator, ExecutionContext, Logger, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { Context as TelegrafContext } from 'telegraf';
import { UserEntity } from '../../features/user-management/entities/user.entity';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserEntity => {
    const logger = new Logger('UserDecorator');
    const telegrafContext = ctx.getArgByIndex<TelegrafContext & { session?: { userEntity?: UserEntity } }>(0);

    if (!telegrafContext) {
      logger.error('Telegraf context is missing in UserDecorator.');
      throw new InternalServerErrorException('Telegraf context not found.');
    }

    // Assuming userEntity is stored in session by AuthenticatedGuard or a login process
    const userEntity = telegrafContext.session?.userEntity;

    if (!userEntity) {
      logger.warn('UserEntity not found in session. User might not be authenticated or session is not properly set.');
      // Depending on strictness, you might throw UnauthorizedException or allow null/undefined
      // For now, let's throw if user is expected to be authenticated by a guard before this decorator is used.
      throw new UnauthorizedException('User not authenticated or session missing user data.');
    }

    // Ensure it's an instance of UserEntity
    if (!(userEntity instanceof UserEntity)) {
        logger.error('Session user data is not a valid UserEntity instance. Data received:', userEntity);
        throw new InternalServerErrorException('Invalid user data format in session.');
    }

    return userEntity;
  },
);
