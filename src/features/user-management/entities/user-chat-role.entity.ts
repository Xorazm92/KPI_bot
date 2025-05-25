import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserEntity } from './user.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

@Entity('user_chat_roles')
@Unique(['user', 'chatId']) // yoki @Unique(['userId', 'chatId']) agar JoinColumn ishlatilmasa
export class UserChatRoleEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, (user) => user.chatRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column()
  userId: string; // Foreign key uchun

  @Column({ type: 'bigint' })
  chatId: number;

  @Column({ type: 'varchar' })
  chatType: string; // 'private', 'group', 'supergroup', 'channel'

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CLIENT })
  role: UserRole;

  @Column({ nullable: true })
  chatTitle?: string; // Guruh yoki kanal nomi, qulaylik uchun
}
