import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageLogEntity } from '../message-logging/entities/message-log.entity';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class ResponseTimeTrackingService {
  private readonly logger = new Logger(ResponseTimeTrackingService.name);

  constructor(
    @InjectRepository(MessageLogEntity)
    private readonly messageLogRepository: Repository<MessageLogEntity>,
  ) {}

  async processNewMessageLog(newMessageLog: MessageLogEntity): Promise<void> {
    this.logger.debug(`Processing message log ID: ${newMessageLog.id} for response time tracking.`);

    // TODO: Implement logic for CLIENT questions
    // if (newMessageLog.sender_role_at_moment === UserRole.CLIENT && newMessageLog.is_question) {
    //   newMessageLog.question_status = 'PENDING';
    //   await this.messageLogRepository.save(newMessageLog);
    //   this.logger.log(`Marked message ${newMessageLog.id} as PENDING question.`);
    // }

    // TODO: Implement logic for agent replies
    // if (newMessageLog.is_reply_to_message_id && newMessageLog.sender_role_at_moment !== UserRole.CLIENT) {
    //   const originalQuestionLog = await this.messageLogRepository.findOne({
    //     where: { telegramMessageId: newMessageLog.is_reply_to_message_id, chatId: newMessageLog.chatId }
    //   });
    //   if (originalQuestionLog && originalQuestionLog.question_status === 'PENDING') {
    //     originalQuestionLog.question_status = 'ANSWERED';
    //     originalQuestionLog.answered_by_message_id = newMessageLog.telegramMessageId;
    //     originalQuestionLog.response_time_seconds = Math.floor((newMessageLog.timestamp.getTime() - originalQuestionLog.timestamp.getTime()) / 1000);
    //     originalQuestionLog.answer_detection_method = 'REPLY';
    //     await this.messageLogRepository.save(originalQuestionLog);
    //     this.logger.log(`Marked question ${originalQuestionLog.id} as ANSWERED by message ${newMessageLog.id}. Response time: ${originalQuestionLog.response_time_seconds}s.`);
    //   }
    // }
  }
}
