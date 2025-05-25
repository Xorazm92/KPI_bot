import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../user-management/entities/user.entity';
import { Chat as TelegrafChat, Message as TelegrafMessage } from 'telegraf/types';
import { MessageLogEntity, MessageDirection, QuestionStatus } from './entities/message-log.entity';
import { ResponseTimeTrackingService } from '../response-time/response-time.service';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class MessageLoggingService {
  private readonly logger = new Logger(MessageLoggingService.name);

  constructor(
    @InjectRepository(MessageLogEntity)
    private readonly messageLogRepository: Repository<MessageLogEntity>,
    private readonly responseTimeTrackingService: ResponseTimeTrackingService,
  ) {}

  async logMessage(
    telegramMessage: TelegrafMessage,
    user: UserEntity,
    chat: TelegrafChat,
    direction: MessageDirection,
    senderRoleAtMoment: UserRole,
  ): Promise<void> {
    let messageText: string | undefined;
    if ('text' in telegramMessage) {
      messageText = telegramMessage.text;
    } else if ('caption' in telegramMessage) {
      messageText = telegramMessage.caption;
    }

    let isQuestion = false;
    let questionStatusToSet: QuestionStatus | null = null;

    if (direction === MessageDirection.INCOMING && senderRoleAtMoment === UserRole.CLIENT && messageText) {
      const lowerCaseText = messageText.toLowerCase();
      const questionKeywords = [
        'qachon', 'қандай', 'нима учун', 'kim', 'qayerda', 
        'savol', 'help', 
        'nima', 'nega', 'qanaqa', 'qanday qilib', 
        'почему', 'когда', 'как', 'где', 'кто', 'что', 'сколько' 
      ];

      if (messageText.endsWith('?') || questionKeywords.some(keyword => lowerCaseText.includes(keyword))) {
        isQuestion = true;
        questionStatusToSet = QuestionStatus.PENDING;
      }
    }

    const logEntry = this.messageLogRepository.create({
      telegramMessageId: telegramMessage.message_id,
      user: user,
      chatId: chat.id,
      text: messageText,
      direction: direction,
      timestamp: new Date(telegramMessage.date * 1000),
      rawMessage: telegramMessage,
      senderRoleAtMoment: senderRoleAtMoment,
      isQuestion: isQuestion,
      questionStatus: questionStatusToSet,
    });

    try {
      const savedMessageLog = await this.messageLogRepository.save(logEntry);
      this.logger.log(
        `[ChatID: ${chat.id}] [User: ${user.telegramId}] [Role: ${senderRoleAtMoment}] [Direction: ${direction}] Logged message ID ${telegramMessage.message_id}${isQuestion ? ' (Question)' : ''}`,
      );

      if (direction === MessageDirection.INCOMING || (direction === MessageDirection.OUTGOING && 'reply_to_message' in telegramMessage)) {
        await this.responseTimeTrackingService.processNewMessageLog(savedMessageLog);
      }

    } catch (error) {
      this.logger.error(
        `Failed to save message log for message ID ${telegramMessage.message_id} from user ${user.telegramId} in chat ${chat.id}: ${error.message}`,
        error.stack,
      );
    }
  }
}
