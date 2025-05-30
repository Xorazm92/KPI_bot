import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Message as TelegrafMessage,
  Chat as TelegrafChat,
} from 'telegraf/typings/core/types/typegram';
import { ConfigService } from '@nestjs/config';
import {
  MessageLogEntity,
  MessageDirection,
} from './entities/message-log.entity';
import { UserEntity } from '../user-management/entities/user.entity';
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
    user: UserEntity | null,
    chat: TelegrafChat,
    direction: MessageDirection,
    senderRole: UserRole | null,
    explicitTextContent?: string,
    isQuestionOverride?: boolean,
    attachmentType?: string,
  ): Promise<MessageLogEntity | null> {
    if (!telegramMessage || !telegramMessage.message_id) {
      this.logger.warn(
        'logMessage called with null, undefined telegramMessage object, or message without ID. Skipping.',
      );
      return null;
    }

    let messageText: string | null =
      explicitTextContent !== undefined ? explicitTextContent : null;
    let fileId: string | null = null;
    let fileUniqueId: string | null = null;
    let duration: number | null = null;

    if ('text' in telegramMessage) {
      messageText = telegramMessage.text;
    }
    if ('voice' in telegramMessage && telegramMessage.voice) {
      fileId = telegramMessage.voice.file_id;
      fileUniqueId = telegramMessage.voice.file_unique_id;
      duration = telegramMessage.voice.duration;
      if (attachmentType === undefined) {
        attachmentType = 'VOICE';
      }
    } else if ('audio' in telegramMessage && telegramMessage.audio) {
      fileId = telegramMessage.audio.file_id;
      fileUniqueId = telegramMessage.audio.file_unique_id;
      duration = telegramMessage.audio.duration;
      if (attachmentType === undefined) {
        attachmentType = 'AUDIO';
      }
    } else if ('document' in telegramMessage && telegramMessage.document) {
      fileId = telegramMessage.document.file_id;
      fileUniqueId = telegramMessage.document.file_unique_id;
      if (attachmentType === undefined) {
        attachmentType = 'DOCUMENT';
      }
    }
    if (
      'caption' in telegramMessage &&
      telegramMessage.caption &&
      !messageText
    ) {
      messageText = telegramMessage.caption;
    }

    const sttStatus =
      attachmentType === 'VOICE' && fileId
        ? SttStatusEnum.PENDING
        : SttStatusEnum.NOT_APPLICABLE;

    const messageLogData: Partial<MessageLogEntity> = {
      telegramMessageId: telegramMessage.message_id,
      user: user === null ? undefined : user,
      senderRoleAtMoment: senderRole === null ? undefined : senderRole,
      chatId: chat.id,
      text: messageText === null ? undefined : messageText,
      direction: direction,
      timestamp: new Date(telegramMessage.date * 1000),
      rawMessage: telegramMessage,
      attachmentType: attachmentType || null,
      attachmentFileId: fileId,
      attachmentFileUniqueId: fileUniqueId,
      attachmentDurationSeconds: duration,
      sttStatus: sttStatus,
      llmAnalysisStatus: LlmAnalysisStatusEnum.NOT_APPLICABLE,
      isQuestion: isQuestionOverride !== undefined ? isQuestionOverride : false,
      questionStatusTemp: 'NONE',
    };

    const messageLog = new MessageLogEntity(messageLogData);

    try {
      const savedMessageLog = await this.messageLogRepository.save(messageLog);
      this.logger.log(
        `Logged ${direction} message from user ${user?.telegramId || 'bot'} (Role: ${senderRole || 'N/A'}) in chat ${chat.id}. Text: "${messageText ? (messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText) : attachmentType ? '[' + attachmentType + ']' : '[no text/media]'}". DB ID: ${savedMessageLog.id}. IsQ: ${savedMessageLog.isQuestion}`,
      );

      return savedMessageLog;
    } catch (error) {
      this.logger.error(
        `Error logging message from user ${user?.telegramId || 'bot'} in chat ${chat.id} (TG MSG ID: ${telegramMessage.message_id}): ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  async updateMessageLogSttStatus(
    messageLogId: string,
    newStatus: SttStatusEnum,
  ): Promise<MessageLogEntity | null> {
    try {
      const messageLog = await this.messageLogRepository.findOne({
        where: { id: messageLogId },
      });
      if (!messageLog) {
        this.logger.warn(
          `MessageLogEntity not found with ID: ${messageLogId} for STT status update.`,
        );
        return null;
      }
      messageLog.sttStatus = newStatus;
      const updatedLog = await this.messageLogRepository.save(messageLog);
      this.logger.log(
        `Updated STT status to '${newStatus}' for MessageLog ID: ${messageLogId}`,
      );
      return updatedLog;
    } catch (error) {
      this.logger.error(
        `Error updating STT status for MessageLog ID ${messageLogId}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  async updateMessageLogWithTranscription(
    messageLogId: string,
    transcribedText: string,
  ): Promise<MessageLogEntity | null> {
    try {
      const messageLog = await this.messageLogRepository.findOne({
        where: { id: messageLogId },
      });
      if (!messageLog) {
        this.logger.warn(
          `MessageLogEntity not found with ID: ${messageLogId} for transcription update.`,
        );
        return null;
      }
      messageLog.transcribedText = transcribedText;
      if (messageLog.attachmentType === 'VOICE' && !messageLog.text) {
        messageLog.text = transcribedText;
      }
      messageLog.sttStatus = SttStatusEnum.COMPLETED;
      const updatedLog = await this.messageLogRepository.save(messageLog);
      this.logger.log(
        `Updated MessageLog ID: ${messageLogId} with transcription and STT status COMPLETED.`,
      );
      return updatedLog;
    } catch (error) {
      this.logger.error(
        `Error updating MessageLog ID ${messageLogId} with transcription: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  async updateMessageLogLlmStatus(
    messageLogId: string,
    newStatus: LlmAnalysisStatusEnum,
  ): Promise<MessageLogEntity | null> {
    try {
      const messageLog = await this.messageLogRepository.findOne({
        where: { id: messageLogId },
      });
      if (!messageLog) {
        this.logger.warn(
          `MessageLogEntity not found with ID: ${messageLogId} for LLM status update.`,
        );
        return null;
      }
      messageLog.llmAnalysisStatus = newStatus;
      const updatedLog = await this.messageLogRepository.save(messageLog);
      this.logger.log(
        `Updated LLM analysis status to '${newStatus}' for MessageLog ID: ${messageLogId}`,
      );
      return updatedLog;
    } catch (error) {
      this.logger.error(
        `Error updating LLM status for MessageLog ID ${messageLogId}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  async updateMessageLogWithLlmResult(
    messageLogId: string,
    promptType: string,
    prompt: string,
    rawResponse: string,
    structuredResponse?: any,
  ): Promise<MessageLogEntity | null> {
    try {
      const messageLog = await this.messageLogRepository.findOne({
        where: { id: messageLogId },
      });
      if (!messageLog) {
        this.logger.warn(
          `MessageLogEntity not found with ID: ${messageLogId} for LLM result update.`,
        );
        return null;
      }
      messageLog.llmPromptType = promptType;
      messageLog.llmAnalysisPrompt = prompt;
      messageLog.llmAnalysisResponse = rawResponse;
      if (structuredResponse) {
        messageLog.llmStructuredResponse = structuredResponse;
      }
      messageLog.llmAnalysisStatus = LlmAnalysisStatusEnum.COMPLETED;
      const updatedLog = await this.messageLogRepository.save(messageLog);
      this.logger.log(
        `Updated MessageLog ID: ${messageLogId} with LLM analysis result (type: ${promptType}), status COMPLETED.`,
      );
      return updatedLog;
    } catch (error) {
      this.logger.error(
        `Error updating MessageLog ID ${messageLogId} with LLM result: ${error.message}`,
        error.stack,
      );
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
          telegramMessageId: telegramMessageId,
          chatId: chatId,
        },
      });
      return messageLog;
    } catch (error) {
      this.logger.error(
        `Error finding message log by Telegram ID ${telegramMessageId} and chat ID ${chatId}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }
}
