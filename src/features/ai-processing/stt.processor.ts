import { Processor, Process, OnQueueActive, OnQueueError, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { TelegramBaseService } from '../telegram-base/telegram-base.service'; 
import { MessageLoggingService } from '../message-logging/message-logging.service';
import { SttStatusEnum } from './enums/stt-status.enum';
import { SttJobData } from './interfaces/stt-job-data.interface';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AiQueueService } from './ai-queue.service'; 
import { LlmAnalysisStatusEnum } from './enums/llm-analysis-status.enum'; 
import { HttpService } from '@nestjs/axios';
import FormData from 'form-data';
import { firstValueFrom } from 'rxjs';

@Processor('stt-queue')
export class SttProcessor {
  private readonly logger = new Logger(SttProcessor.name);
  private readonly downloadPath: string;
  private readonly sttServiceUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramService: TelegramBaseService, 
    private readonly messageLoggingService: MessageLoggingService,
    private readonly aiQueueService: AiQueueService, 
    private readonly httpService: HttpService,
  ) {
    this.downloadPath = this.configService.get<string>('AUDIO_DOWNLOAD_PATH', './temp_audio_files');
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
    }
    this.sttServiceUrl = this.configService.get<string>('STT_SERVICE_URL')!;
    if (!this.sttServiceUrl) {
      this.logger.warn('STT_SERVICE_URL is not defined in .env file. STT processing will likely fail.');
    }
  }

  @Process('transcribe-audio')
  async handleTranscribeAudio(job: Job<SttJobData>): Promise<void> {
    const { audioFileId, messageLogId, chatId, telegramUserId } = job.data;
    this.logger.log(`Processing STT job ${job.id} for messageLogId: ${messageLogId}, audioFileId: ${audioFileId}`);

    let localFilePath: string | undefined;

    try {
      // 1. Statusni PROCESSING ga o'zgartirish
      await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.PROCESSING);

      // 2. Faylni Telegramdan yuklab olish
      this.logger.log(`Downloading audio file ${audioFileId} for job ${job.id}`);
      await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.DOWNLOADING_FILE);
      
      const fileLink = await this.telegramService.getFileLink(audioFileId);
      if (!fileLink) {
        this.logger.error(`Could not retrieve file link for audio file ID: ${audioFileId}`);
        await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.FAILED_NO_FILE_LINK);
        return;
      }
      const fileExtension = path.extname(new URL(fileLink).pathname) || '.oga'; 
      localFilePath = path.join(this.downloadPath, `${randomUUID()}${fileExtension}`);
      
      await this.telegramService.downloadFile(fileLink, localFilePath);
      this.logger.log(`Audio file ${audioFileId} downloaded to ${localFilePath} for job ${job.id}`);

      // 3. STT servisiga yuborish
      await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.SENDING_TO_STT);
      this.logger.log(`Sending ${localFilePath} to STT service for job ${job.id}`);
      
      const formData = new FormData();
      formData.append('audio_file', fs.createReadStream(localFilePath));

      const sttApiEndpoint = `${this.sttServiceUrl}/transcribe`;
      this.logger.log(`Sending audio to STT service: ${sttApiEndpoint}`);

      const sttResponse = await firstValueFrom(
        this.httpService.post(sttApiEndpoint, formData, {
          headers: formData.getHeaders(),
          timeout: 60000,
        })
      );

      if (!sttResponse.data || !sttResponse.data.transcription) {
        this.logger.error(`Invalid response from STT service: ${JSON.stringify(sttResponse.data)}`);
        await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.FAILED_STT_SERVICE);
        return;
      }
      const transcription = sttResponse.data.transcription;
      this.logger.log(`Transcription received for job ${job.id}: ${transcription.substring(0, 50)}...`);

      // 4. Natijani MessageLogEntity ga saqlash
      const updatedLog = await this.messageLoggingService.updateMessageLogWithTranscription(messageLogId, transcription);
      if (updatedLog && updatedLog.stt_status === SttStatusEnum.COMPLETED) {
        this.logger.log(`[STT Job ${job.id}] STT result saved for messageLogId: ${messageLogId}. Adding LLM analysis job.`);
        // STT muvaffaqiyatli yakunlandi, LLM tahlilini ishga tushiramiz
        await this.aiQueueService.addLlmAnalysisJob({
          messageLogId: messageLogId,
          textToAnalyze: transcription,
          promptType: 'VOICE_MESSAGE_ANALYSIS', 
        });
        // LLM uchun boshlang'ich statusni PENDING qilib belgilash
        await this.messageLoggingService.updateMessageLogLlmStatus(messageLogId, LlmAnalysisStatusEnum.PENDING);
      } else {
        this.logger.warn(`[STT Job ${job.id}] STT result could not be saved or status not COMPLETED for messageLogId: ${messageLogId}. LLM job not added.`);
      }

    } catch (error) {
      this.logger.error(`Error processing STT job ${job.id} for messageLogId ${messageLogId}: ${error.message}`, error.stack);
      // Xatolik turiga qarab statusni o'rnatish
      if (error.response) { 
        this.logger.error(`STT Service Error Response: ${JSON.stringify(error.response.data)}`);
        await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.FAILED_STT_SERVICE);
      } else if (error.request) { 
        await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.FAILED_STT_NO_RESPONSE);
      } else { 
        await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.FAILED_UNKNOWN);
      }
      // Jobni fail qilish uchun xatolikni qayta throw qilish
      throw error; 
    } finally {
      // 5. Vaqtinchalik faylni o'chirish
      if (localFilePath && fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
          this.logger.log(`Deleted temporary file ${localFilePath} for job ${job.id}`);
        } catch (unlinkError) {
          this.logger.error(`Failed to delete temporary file ${localFilePath} for job ${job.id}: ${unlinkError.message}`);
        }
      }
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name} with data ${JSON.stringify(job.data)}...`);
  }

  @OnQueueError()
  onError(error: Error) {
    this.logger.error(`Queue error: ${error.message}`, error.stack);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} of type ${job.name} failed: ${error.message}`, error.stack);
    // Bu yerda xabarni MessageLog da FAILED_UNKNOWN ga o'tkazishimiz mumkin, agar handleTranscribeAudio da qilinmagan bo'lsa
    // const { messageLogId } = job.data as SttJobData;
    // if (messageLogId) {
    //   this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.FAILED_UNKNOWN)
    //     .catch(e => this.logger.error(`Failed to update status on job failure for ${messageLogId}: ${e.message}`));
    // }
  }
}
