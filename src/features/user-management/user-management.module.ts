import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { UserChatRoleEntity } from './entities/user-chat-role.entity';
import { UserSessionEntity } from './entities/user-session.entity';
import { UserManagementService } from './user-management.service';
import { TelegramBaseModule } from '../telegram-base/telegram-base.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserChatRoleEntity, UserSessionEntity]),
    forwardRef(() => TelegramBaseModule),
  ],
  providers: [UserManagementService],
  exports: [UserManagementService, TypeOrmModule],
})
export class UserManagementModule {}
