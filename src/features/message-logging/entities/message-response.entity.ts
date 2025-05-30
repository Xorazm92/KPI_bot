import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { MessageLogEntity } from './message-log.entity';

@Entity('message_responses')
export class MessageResponseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MessageLogEntity, (message) => message.responses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'originalMessageId' })
  originalMessage: MessageLogEntity;

  @Column()
  originalMessageId: string;

  @Column()
  responseMessageId: string;

  @Column()
  responderId: string;

  @Column({ type: 'timestamp' })
  responseTime: Date;

  @Column({ nullable: true })
  responseTimeSeconds: number;

  @Column('text', { nullable: true })
  responseText: string;

  @CreateDateColumn()
  createdAt: Date;

  constructor(partial: Partial<MessageResponseEntity>) {
    Object.assign(this, partial);
  }
}


