import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { UserEntity } from '../../user-management/entities/user.entity';
import { UserRole } from '../../../common/enums/user-role.enum'; 
import { SttStatusEnum } from '../../ai-processing/enums/stt-status.enum'; // To'g'rilangan yo'l
import { LlmAnalysisStatusEnum } from '../../ai-processing/enums/llm-analysis-status.enum'; // To'g'rilangan yo'l

export { UserRole }; // Re-export UserRole

export enum MessageDirection {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
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
    nullable: true, 
  })
  direction?: MessageDirection;

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

  @Column({ type: 'varchar', length: 20, nullable: true }) // Placeholder for question_status
  questionStatusTemp: string;

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
  transcribedText: string | null; // STT natijasida olingan matn

  @Column({ type: 'varchar', length: 50, nullable: true })
  attachmentType: string | null; // Xabardagi fayl turi (VOICE, AUDIO, DOCUMENT, etc.)

  @Column({ type: 'varchar', length: 255, nullable: true }) // Increased length for file_id
  attachmentFileId: string | null; // Faylning Telegramdagi file_id si

  @Column({ type: 'varchar', length: 255, nullable: true })
  attachmentFileUniqueId: string | null; // Faylning Telegramdagi file_unique_id si

  @Column({ type: 'integer', nullable: true })
  attachmentDurationSeconds: number | null; // Ovozli/video xabar davomiyligi (sekundlarda)

  @Column({
    type: 'enum',
    enum: SttStatusEnum,
    default: SttStatusEnum.NOT_APPLICABLE,
    nullable: true,
  })
  sttStatus: SttStatusEnum | null; // STT jarayonining statusi

  // LLM Analysis Fields
  @Column({
    type: 'enum',
    enum: LlmAnalysisStatusEnum,
    default: LlmAnalysisStatusEnum.NOT_APPLICABLE,
    nullable: true,
  })
  llmAnalysisStatus: LlmAnalysisStatusEnum | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  llmPromptType: string | null; // Masalan, 'RESPONSE_QUALITY', 'SENTIMENT_ANALYSIS'

  @Column({ type: 'text', nullable: true })
  llmAnalysisPrompt: string | null; // LLM ga yuborilgan to'liq prompt

  @Column({ type: 'text', nullable: true })
  llmAnalysisResponse: string | null; // LLM dan kelgan xom javob

  @Column({ type: 'jsonb', nullable: true })
  llmStructuredResponse: any | null; // LLM javobidan ajratib olingan tuzilmali ma'lumot

  constructor(partial: Partial<MessageLogEntity>) {
    Object.assign(this, partial);
  }
}
