import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { NotificationEntity } from './entities/notification.entity';
import { UserEntity } from '../user-management/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity, UserEntity])],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
