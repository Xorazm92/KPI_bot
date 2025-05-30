import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserEntity } from './user.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

/**
 * UserChatRoleEntity
 * Foydalanuvchi va chatdagi roli. Har bir user har bir chatda bir nechta rolda bo'lishi mumkin emas.
 */
@Entity('user_chat_roles')
@Unique(['userId', 'chatId'])
export class UserChatRoleEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, (user) => user.chatRoles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column()
  userId: string;

  @Column({ type: 'bigint' })
  chatId: number;

  @Column({ type: 'varchar', length: 32 })
  chatType: string; // 'private', 'group', 'supergroup', 'channel'

  @Column({ type: 'enum', enum: UserRole, default: UserRole.ACCOUNTANT })
  role: UserRole;

  @Column({ nullable: true })
  chatTitle?: string; // Guruh yoki kanal nomi

  @Column({ default: true })
  isActive: boolean; // Chatdagi roli aktiv yoki yo'qligi
}
