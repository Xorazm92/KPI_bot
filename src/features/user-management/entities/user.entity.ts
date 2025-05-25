import { Entity, Column, OneToMany, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserChatRoleEntity } from './user-chat-role.entity';
import { MessageLogEntity } from '../../message-logging/entities/message-log.entity';

@Entity('users')
@Unique(['telegramId'])
export class UserEntity extends BaseEntity {
  @Column({ type: 'bigint', unique: true })
  telegramId: number;

  @Column({ nullable: true })
  username?: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ default: false })
  isBot?: boolean;

  @Column({ nullable: true })
  languageCode?: string;

  @OneToMany(() => UserChatRoleEntity, (userChatRole) => userChatRole.user)
  chatRoles: UserChatRoleEntity[];

  @OneToMany(() => MessageLogEntity, (messageLog) => messageLog.user)
  messageLogs: MessageLogEntity[];
}
