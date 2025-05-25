import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { UserEntity } from '../../user-management/entities/user.entity';
import { UserRole } from '../../../common/enums/user-role.enum'; 
import { SttStatusEnum } from '../../ai-processing/enums/stt-status.enum'; // To'g'rilangan yo'l
import { LlmAnalysisStatusEnum } from '../../ai-processing/enums/llm-analysis-status.enum'; // To'g'rilangan yo'l

export { UserRole }; // Re-export UserRole

// Vaqtincha shu yerda, agar alohida fayl yaratishda muammo bo'lsa
export enum MessageDirection {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
}

export enum QuestionStatus {
  PENDING = 'PENDING',     // Javob kutilmoqda
  ANSWERED = 'ANSWERED',   // Javob berildi
  CLOSED = 'CLOSED',     // Savol yopildi (masalan, foydalanuvchi tomonidan)
  TIMED_OUT = 'TIMED_OUT', // Javob berish vaqti tugadi
  TIMEOUT_CLIENT = 'TIMEOUT_CLIENT', 
  TIMEOUT_AGENT = 'TIMEOUT_AGENT',   
}

export enum AnswerDetectionMethod {
  REPLY = 'REPLY',                         // To'g'ridan-to'g'ri javob (reply)
  TIME_WINDOW_SIMPLE = 'TIME_WINDOW_SIMPLE', // Vaqt oralig'ida kelgan javob (oddiy)
  AI_CONFIRMED = 'AI_CONFIRMED',
  SYSTEM_TIMEOUT = 'SYSTEM_TIMEOUT',     // Tizim tomonidan vaqt tugashi
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

  @ManyToOne(() => UserEntity, { nullable: true, eager: false }) 
  answeredByUser?: UserEntity;

  @Column({ type: 'integer', nullable: true })
  responseTimeSeconds?: number;

  @Column({
    type: 'enum',
    enum: AnswerDetectionMethod,
    nullable: true,
  })
  answerDetectionMethod?: AnswerDetectionMethod;

  @Column({ type: 'text', nullable: true })
  transcribed_text: string | null; // STT natijasida olingan matn

  @Column({ type: 'varchar', length: 50, nullable: true })
  attachment_type: string | null; // Xabardagi fayl turi (VOICE, AUDIO, DOCUMENT, etc.)

  @Column({
    type: 'enum',
    enum: SttStatusEnum,
    nullable: true,
  })
  stt_status: SttStatusEnum | null; // STT jarayonining statusi

  // LLM Analysis Fields
  @Column({
    type: 'enum',
    enum: LlmAnalysisStatusEnum,
    nullable: true,
  })
  llm_analysis_status: LlmAnalysisStatusEnum | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  llm_prompt_type: string | null; // Masalan, 'RESPONSE_QUALITY', 'SENTIMENT_ANALYSIS'

  @Column({ type: 'text', nullable: true })
  llm_analysis_prompt: string | null; // LLM ga yuborilgan to'liq prompt

  @Column({ type: 'text', nullable: true })
  llm_analysis_response: string | null; // LLM dan kelgan xom javob

  @Column({ type: 'jsonb', nullable: true })
  llm_structured_response: any | null; // LLM javobidan ajratib olingan tuzilmali ma'lumot

  constructor(partial: Partial<MessageLogEntity>) {
    Object.assign(this, partial);
  }
}
