import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageLogEntity, MessageDirection, QuestionStatus } from './entities/message-log.entity';
import { UserEntity } from '../user-management/entities/user.entity';
import { Chat as TelegrafChat, Message as TelegrafMessage } from 'telegraf/types';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../common/enums/user-role.enum';
import { SttStatusEnum } from '../ai-processing/enums/stt-status.enum';
import { LlmAnalysisStatusEnum } from '../ai-processing/enums/llm-analysis-status.enum';

@Injectable()
export class MessageLoggingService {
  private readonly logger = new Logger(MessageLoggingService.name);

  constructor(
    @InjectRepository(MessageLogEntity)
    private readonly messageLogRepository: Repository<MessageLogEntity>,
    private readonly configService: ConfigService,
  ) {}

  async logMessage(
    telegramMessage: TelegrafMessage,
    user: UserEntity,
    chat: TelegrafChat,
    direction: MessageDirection,
    senderRoleAtMoment: UserRole,
    additionalFields?: Partial<MessageLogEntity>
  ): Promise<MessageLogEntity> {
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

    const newMessageLog = this.messageLogRepository.create({
      telegramMessageId: telegramMessage.message_id,
      user,
      chatId: chat.id,
      text: messageText,
      direction,
      timestamp: new Date(telegramMessage.date * 1000),
      rawMessage: telegramMessage,
      senderRoleAtMoment,
      isQuestion,
      questionStatus: isQuestion ? QuestionStatus.PENDING : undefined,
      stt_status: SttStatusEnum.PENDING, 
      ...additionalFields,
    });

    try {
      const savedMessageLog: MessageLogEntity = await this.messageLogRepository.save(newMessageLog);
      this.logger.log(
        `Logged ${direction} message from user ${user.telegramId} (Role: ${senderRoleAtMoment}) in chat ${chat.id}. Text: "${messageText ? (messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText) : '[no text]'}". Question: ${isQuestion}, Status: ${savedMessageLog.questionStatus}`,
      );
      return savedMessageLog;
    } catch (error) {
      this.logger.error(
        `Failed to save message log for message ID ${telegramMessage.message_id} from user ${user.telegramId} in chat ${chat.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateMessageLogSttStatus(messageLogId: string, newStatus: SttStatusEnum): Promise<MessageLogEntity | null> {
    try {
      const messageLog = await this.messageLogRepository.findOne({ where: { id: messageLogId } });
      if (!messageLog) {
        this.logger.warn(`MessageLogEntity not found with ID: ${messageLogId} for STT status update.`);
        return null;
      }
      messageLog.stt_status = newStatus;
      const updatedLog = await this.messageLogRepository.save(messageLog);
      this.logger.log(`Updated STT status to '${newStatus}' for MessageLog ID: ${messageLogId}`);
      return updatedLog;
    } catch (error) {
      this.logger.error(`Error updating STT status for MessageLog ID ${messageLogId}: ${error.message}`, error.stack);
      return null;
    }
  }

  async updateMessageLogWithTranscription(messageLogId: string, transcribedText: string): Promise<MessageLogEntity | null> {
    try {
      const messageLog = await this.messageLogRepository.findOne({ where: { id: messageLogId } });
      if (!messageLog) {
        this.logger.warn(`MessageLogEntity not found with ID: ${messageLogId} for transcription update.`);
        return null;
      }
      messageLog.transcribed_text = transcribedText;
      if (messageLog.attachment_type === 'VOICE' && !messageLog.text) {
        messageLog.text = transcribedText; 
      }
      messageLog.stt_status = SttStatusEnum.COMPLETED; 
      const updatedLog = await this.messageLogRepository.save(messageLog);
      this.logger.log(`Updated MessageLog ID: ${messageLogId} with transcription and STT status COMPLETED.`);
      return updatedLog;
    } catch (error) {
      this.logger.error(`Error updating MessageLog ID ${messageLogId} with transcription: ${error.message}`, error.stack);
      return null;
    }
  }

  async updateMessageLogLlmStatus(messageLogId: string, newStatus: LlmAnalysisStatusEnum): Promise<MessageLogEntity | null> {
    try {
      const messageLog = await this.messageLogRepository.findOne({ where: { id: messageLogId } });
      if (!messageLog) {
        this.logger.warn(`MessageLogEntity not found with ID: ${messageLogId} for LLM status update.`);
        return null;
      }
      messageLog.llm_analysis_status = newStatus;
      const updatedLog = await this.messageLogRepository.save(messageLog);
      this.logger.log(`Updated LLM analysis status to '${newStatus}' for MessageLog ID: ${messageLogId}`);
      return updatedLog;
    } catch (error) {
      this.logger.error(`Error updating LLM status for MessageLog ID ${messageLogId}: ${error.message}`, error.stack);
      return null;
    }
  }

  async updateMessageLogWithLlmResult(
    messageLogId: string, 
    promptType: string,
    prompt: string, 
    rawResponse: string, 
    structuredResponse?: any
  ): Promise<MessageLogEntity | null> {
    try {
      const messageLog = await this.messageLogRepository.findOne({ where: { id: messageLogId } });
      if (!messageLog) {
        this.logger.warn(`MessageLogEntity not found with ID: ${messageLogId} for LLM result update.`);
        return null;
      }
      messageLog.llm_prompt_type = promptType;
      messageLog.llm_analysis_prompt = prompt;
      messageLog.llm_analysis_response = rawResponse;
      if (structuredResponse) {
        messageLog.llm_structured_response = structuredResponse;
      }
      messageLog.llm_analysis_status = LlmAnalysisStatusEnum.COMPLETED;
      const updatedLog = await this.messageLogRepository.save(messageLog);
      this.logger.log(`Updated MessageLog ID: ${messageLogId} with LLM analysis result (type: ${promptType}), status COMPLETED.`);
      return updatedLog;
    } catch (error) {
      this.logger.error(`Error updating MessageLog ID ${messageLogId} with LLM result: ${error.message}`, error.stack);
      return null;
    }
  }

  async findMessageByTelegramIdAndChatId(
    telegramMessageId: number,
    chatId: number,
  ): Promise<MessageLogEntity | null> {
    try {
      const messageLog = await this.messageLogRepository.findOne({
        where: {
          telegramMessageId,
          chatId,
        },
      });
      return messageLog;
    } catch (error) {
      this.logger.error(`Error finding message log by Telegram ID ${telegramMessageId} and chat ID ${chatId}: ${error.message}`, error.stack);
      return null;
    }
  }
}
