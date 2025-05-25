import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { UserEntity } from '../../user-management/entities/user.entity';
import { UserRole } from '../../../common/enums/user-role.enum'; 

// Vaqtincha shu yerda, agar alohida fayl yaratishda muammo bo'lsa
export enum MessageDirection {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
}

export enum QuestionStatus {
  PENDING = 'PENDING',
  ANSWERED = 'ANSWERED',
  TIMEOUT_CLIENT = 'TIMEOUT_CLIENT', 
  TIMEOUT_AGENT = 'TIMEOUT_AGENT',   
}

export enum AnswerDetectionMethod {
  REPLY = 'REPLY',
  TIME_WINDOW_SIMPLE = 'TIME_WINDOW_SIMPLE',
  AI_CONFIRMED = 'AI_CONFIRMED',
}

@Entity('message_logs')
export class MessageLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'bigint', nullable: true }) 
  telegramMessageId?: number; 

  @ManyToOne(() => UserEntity, (user) => user.messageLogs, { nullable: false, eager: true }) 
  user: UserEntity;

  @Index()
  @Column({ type: 'bigint' })
  chatId: number;

  @Column({ type: 'text', nullable: true })
  text?: string;

  @Column({
    type: 'enum',
    enum: MessageDirection,
  })
  direction: MessageDirection;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true })
  rawMessage?: any; 

  @Column({
    type: 'enum',
    enum: UserRole,
    nullable: true, 
  })
  senderRoleAtMoment?: UserRole;

  @Column({ type: 'boolean', default: false })
  isQuestion: boolean;

  @Column({
    type: 'enum',
    enum: QuestionStatus,
    nullable: true,
  })
  questionStatus?: QuestionStatus;

  @Column({ type: 'bigint', nullable: true })
  answeredByMessageId?: number;

  @Column({ type: 'integer', nullable: true })
  responseTimeSeconds?: number;

  @Column({
    type: 'enum',
    enum: AnswerDetectionMethod,
    nullable: true,
  })
  answerDetectionMethod?: AnswerDetectionMethod;
}
