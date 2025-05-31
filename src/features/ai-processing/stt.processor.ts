// // STT (Speech-To-Text) uchun kerakli NestJS Bull dekoratorlari import qilinmoqda
// import {
//   Processor,
//   Process,
//   OnQueueActive,
//   OnQueueError,
//   OnQueueFailed,
// } from '@nestjs/bull';
// import { Job } from 'bull';
// import { Logger } from '@nestjs/common';
// import { TelegramBaseService } from '../telegram-base/telegram-base.service';
// import { MessageLoggingService } from '../message-logging/message-logging.service';
// import { SttStatusEnum } from './enums/stt-status.enum';
// import { SttJobData } from './interfaces/stt-job-data.interface';
// import { ConfigService } from '@nestjs/config';
// import * as fs from 'fs';
// import * as path from 'path';
// import { randomUUID } from 'crypto';
// import { AiQueueService } from './ai-queue.service';
// import { LlmAnalysisStatusEnum } from './enums/llm-analysis-status.enum';
// import { HttpService } from '@nestjs/axios';
// import FormData from 'form-data';
// import { firstValueFrom } from 'rxjs';

// @Processor('stt-queue')
// // STT (Speech-To-Text) jarayonini boshqaruvchi asosiy klass
// export class SttProcessor {
//   // Logger - log yozish uchun
//   private readonly logger = new Logger(SttProcessor.name);
//   // Audio fayllarni vaqtincha yuklab olish uchun papka
//   private readonly downloadPath: string;
//   // STT servisi URL manzili (.env dan olinadi)
//   private readonly sttServiceUrl: string;

//   constructor(
//     private readonly configService: ConfigService,
//     private readonly telegramService: TelegramBaseService,
//     private readonly messageLoggingService: MessageLoggingService,
//     private readonly aiQueueService: AiQueueService,
//     private readonly httpService: HttpService,
//   ) {
//     // Audio fayllar uchun vaqtinchalik papkani sozlash
//     this.downloadPath = this.configService.get<string>(
//       'AUDIO_DOWNLOAD_PATH',
//       './temp_audio_files',
//     );
//     if (!fs.existsSync(this.downloadPath)) {
//       fs.mkdirSync(this.downloadPath, { recursive: true });
//     }
//     // STT servisi URL manzilini olish
//     this.sttServiceUrl = this.configService.get<string>('STT_SERVICE_URL')!;
//     if (!this.sttServiceUrl) {
//       this.logger.warn(
//         'STT_SERVICE_URL .env faylda aniqlanmagan. STT ishlashi uchun bu kerak.',
//       );
//     }
//   }

//   /**
//    * Audio faylni matnga o‘girish (transkriptsiya) jarayoni
//    * 1. Telegramdan audio faylni yuklab olish
//    * 2. STT servisiga yuborish (REST API orqali yoki WhisperS2T lokal API orqali)
//    * 3. Natijani logga yozish va LLM navbatiga qo‘yish
//    *
//    * WhisperS2T ni lokalda REST API sifatida ishga tushirsangiz, kodda katta o‘zgarish bo‘lmaydi.
//    * Faqat .env fayldagi STT_SERVICE_URL ni lokal manzilga o‘zgartirasiz.
//    */
//   @Process('transcribe-audio')
//   async handleTranscribeAudio(job: Job<SttJobData>): Promise<void> {
//     const { audioFileId, messageLogId, chatId, telegramUserId } = job.data;
//     this.logger.log(
//       `Processing STT job ${job.id} for messageLogId: ${messageLogId}, audioFileId: ${audioFileId}`,
//     );

//     let localFilePath: string | undefined;

//     try {
//       // 1. Statusni PROCESSING ga o'zgartirish
//       // (Ovozli xabar matnga o‘girilmoqda deb belgilash)
//       await this.messageLoggingService.updateMessageLogSttStatus(
//         messageLogId,
//         SttStatusEnum.PROCESSING,
//       );

//       // 2. Faylni Telegramdan yuklab olish
//       // (Audio faylni serverga yuklab olamiz)
//       this.logger.log(
//         `Downloading audio file ${audioFileId} for job ${job.id}`,
//       );
//       await this.messageLoggingService.updateMessageLogSttStatus(
//         messageLogId,
//         SttStatusEnum.DOWNLOADING_FILE,
//       );

//       const fileLink = await this.telegramService.getFileLink(audioFileId);
//       if (!fileLink) {
//         this.logger.error(
//           `Could not retrieve file link for audio file ID: ${audioFileId}`,
//         );
//         await this.messageLoggingService.updateMessageLogSttStatus(
//           messageLogId,
//           SttStatusEnum.FAILED_NO_FILE_LINK,
//         );
//         return;
//       }
//       const fileExtension = path.extname(new URL(fileLink).pathname) || '.oga';
//       localFilePath = path.join(
//         this.downloadPath,
//         `${randomUUID()}${fileExtension}`,
//       );

//       await this.telegramService.downloadFile(fileLink, localFilePath);
//       this.logger.log(
//         `Audio file ${audioFileId} downloaded to ${localFilePath} for job ${job.id}`,
//       );

//       // 3. STT servisiga yuborish
//       // (WhisperS2T ni REST API ko‘rinishida ishlatsangiz, quyidagi kod o‘zgarmaydi)
//       // (Agar to‘g‘ridan-to‘g‘ri Python chaqiruv bo‘lsa, bu qismni o‘zgartirish kerak)
//       await this.messageLoggingService.updateMessageLogSttStatus(
//         messageLogId,
//         SttStatusEnum.SENDING_TO_STT,
//       );
//       this.logger.log(
//         `Sending ${localFilePath} to STT service for job ${job.id}`,
//       );

//       // FastAPI/FastWhisper uchun multipart form-data parametri nomi 'file' bo'lishi kerak!
//       const formData = new FormData();
//       formData.append('file', fs.createReadStream(localFilePath));

//       const sttApiEndpoint = `${this.sttServiceUrl}/transcribe`;
//       this.logger.log(`Sending audio to STT service: ${sttApiEndpoint}`);
//       this.logger.debug(`FormData headers: ${JSON.stringify(formData.getHeaders())}`);
//       this.logger.debug(`File exists: ${fs.existsSync(localFilePath)} | Path: ${localFilePath}`);

//       // WhisperS2T ni lokalda REST API sifatida ishlatsangiz, STT_SERVICE_URL ni lokal manzilga o‘zgartiring (masalan: http://localhost:9000)
//       let sttResponse;
//       try {
//         sttResponse = await firstValueFrom(
//           this.httpService.post(sttApiEndpoint, formData, {
//             headers: formData.getHeaders(),
//             timeout: 60000,
//           }),
//         );
//       } catch (err) {
//         this.logger.error(`STT service POST error: ${err.message}`, err.stack);
//         if (err.response?.data) {
//           this.logger.error(`STT error response: ${JSON.stringify(err.response.data)}`);
//         }
//         throw err;
//       }

//       // STT javobini har doim to‘liq log qilamiz (debug uchun)
//       this.logger.debug(`STT xom javobi: ${JSON.stringify(sttResponse.data)}`);

//       // transcription propertylarni universal tekshiramiz
//       let transcription =
//         sttResponse.data.transcription ||
//         sttResponse.data.text ||
//         (Array.isArray(sttResponse.data.results) && sttResponse.data.results[0]?.text) ||
//         null;

//       if (!transcription) {
//         this.logger.error(
//           `Invalid response from STT service: ${JSON.stringify(sttResponse.data)}`,
//         );
//         await this.messageLoggingService.updateMessageLogSttStatus(
//           messageLogId,
//           SttStatusEnum.FAILED_STT_SERVICE,
//         );
//         return;
//       }
//       // Logda natijani qisqartirib ko‘rsatamiz
//       const maxLogLen = 100;
//       this.logger.log(
//         `Transcription received for job ${job.id}: ${transcription.length > maxLogLen ? transcription.substring(0, maxLogLen) + '...' : transcription}`,
//       );

//       // 4. Natijani MessageLogEntity ga saqlash
//       // (Matnli natijani bazaga yozamiz va keyingi AI tahlil uchun navbatga faqat STTdan chiqqan text uzatiladi)
//       const updatedLog =
//         await this.messageLoggingService.updateMessageLogWithTranscription(
//           messageLogId,
//           transcription,
//         );

//       this.logger.log(
//         `[STT Job ${job.id}] STT natijasi saqlandi. LLM (AI) tahlil navbatiga faqat STTdan chiqqan text uzatilmoqda.`,
//       );

//       // LLM analiz navbatiga faqat STTdan chiqqan text uzatiladi
//       await this.aiQueueService.addLlmAnalysisJob({
//         messageLogId,
//         promptType: 'VOICE_MESSAGE_ANALYSIS',
//         textToAnalyze: transcription, // faqat STTdan chiqqan text
//       });

//       // LLM uchun boshlang'ich statusni PENDING qilib belgilash
//       await this.messageLoggingService.updateMessageLogLlmStatus(
//         messageLogId,
//         LlmAnalysisStatusEnum.PENDING,
//       );
//     } catch (error) {
//       this.logger.error(
//         `Error processing STT job ${job.id} for messageLogId ${messageLogId}: ${error.message}`,
//         error.stack,
//       );
//       // Xatolik turiga qarab statusni o'rnatish
//       // (Agar STT servisidan javob kelmasa yoki xatolik bo‘lsa, status mos ravishda o‘zgaradi)
//       if (error.response) {
//         this.logger.error(
//           `STT Service Error Response: ${JSON.stringify(error.response.data)}`,
//         );
//         await this.messageLoggingService.updateMessageLogSttStatus(
//           messageLogId,
//           SttStatusEnum.FAILED_STT_SERVICE,
//         );
//       } else if (error.request) {
//         await this.messageLoggingService.updateMessageLogSttStatus(
//           messageLogId,
//           SttStatusEnum.FAILED_STT_NO_RESPONSE,
//         );
//       } else {
//         await this.messageLoggingService.updateMessageLogSttStatus(
//           messageLogId,
//           SttStatusEnum.FAILED_UNKNOWN,
//         );
//       }
//       // Jobni fail qilish uchun xatolikni qayta throw qilish
//       throw error;
//     } finally {
//       // 5. Vaqtinchalik faylni o'chirish
//       // (Diskda joy bo‘shatish uchun yuklab olingan audio faylni o‘chiramiz)
//       if (localFilePath && fs.existsSync(localFilePath)) {
//         try {
//           fs.unlinkSync(localFilePath);
//           this.logger.log(
//             `Deleted temporary file ${localFilePath} for job ${job.id}`,
//           );
//         } catch (unlinkError) {
//           this.logger.error(
//             `Failed to delete temporary file ${localFilePath} for job ${job.id}: ${unlinkError.message}`,
//           );
//         }
//       }
//     }
//   }

//   // Navbatdagi STT job faol bo‘lganda log yoziladi
//   @OnQueueActive()
//   onActive(job: Job) {
//     this.logger.log(
//       `Processing job ${job.id} of type ${job.name} with data ${JSON.stringify(job.data)}...`,
//     );
//   }

//   // Navbatda xatolik bo‘lsa logga yoziladi
//   @OnQueueError()
//   onError(error: Error) {
//     this.logger.error(`Queue error: ${error.message}`, error.stack);
//   }

//   // STT job muvaffaqiyatsiz tugasa logga yoziladi va kerak bo‘lsa status o‘zgartiriladi
//   @OnQueueFailed()
//   onFailed(job: Job, error: Error) {
//     this.logger.error(
//       `Job ${job.id} of type ${job.name} failed: ${error.message}`,
//       error.stack,
//     );
//     // Agar handleTranscribeAudio da status o‘zgartirilmagan bo‘lsa, shu yerda ham qilish mumkin
//     // const { messageLogId } = job.data as SttJobData;
//     // if (messageLogId) {
//     //   this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.FAILED_UNKNOWN)
//     //     .catch(e => this.logger.error(`Failed to update status on job failure for ${messageLogId}: ${e.message}`));
//     // }
//   }
// }
import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueError,
  OnQueueFailed,
} from '@nestjs/bull';
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
    this.downloadPath = this.configService.get<string>(
      'AUDIO_DOWNLOAD_PATH',
      './temp_audio_files',
    );
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
    }
    this.sttServiceUrl = this.configService.get<string>('STT_SERVICE_URL')!;
    if (!this.sttServiceUrl) {
      this.logger.warn(
        'STT_SERVICE_URL is not defined in .env file. STT processing will likely fail.',
      );
    }
  }

  @Process('transcribe-audio')
  async handleTranscribeAudio(job: Job<SttJobData>): Promise<void> {
    const { audioFileId, messageLogId } = job.data;
    this.logger.log(
      `Processing STT job ${job.id} for messageLogId: ${messageLogId}, audioFileId: ${audioFileId}`,
    );

    let localFilePath: string | undefined;

    try {
      await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.PROCESSING);

      // 1. Telegramdan file_link olish (2 marta urinish)
      let fileLink: string | undefined;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          fileLink = await this.telegramService.getFileLink(audioFileId);
          if (fileLink) break;
        } catch (err) {
          this.logger.error(`[${attempt}] getFileLink error: ${err.message}`);
          if (attempt === 2) throw new Error('Could not get file link from Telegram');
        }
      }
      if (!fileLink) {
        this.logger.error(`Could not retrieve file link for audio file ID: ${audioFileId}`);
        await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.FAILED_NO_FILE_LINK);
        return;
      }

      await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.DOWNLOADING_FILE);
      const fileExtension = path.extname(new URL(fileLink).pathname) || '.oga';
      localFilePath = path.join(this.downloadPath, `${randomUUID()}${fileExtension}`);

      // 2. Faylni Telegramdan yuklab olish (2 marta urinish)
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          this.logger.log(`[${attempt}] Downloading audio file ${audioFileId} to ${localFilePath}`);
          await this.telegramService.downloadFile(fileLink, localFilePath);
          if (fs.existsSync(localFilePath)) break;
        } catch (err) {
          this.logger.error(`[${attempt}] downloadFile error: ${err.message}`);
          if (attempt === 2) throw new Error('Failed to download file from Telegram');
        }
      }
      this.logger.log(`Audio file downloaded to ${localFilePath}`);

      // 3. STT servisiga yuborish
      await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.SENDING_TO_STT);
      const formData = new FormData();
      formData.append('file', fs.createReadStream(localFilePath));
      const sttApiEndpoint = `${this.sttServiceUrl}/transcribe`;
      let sttResponse;
      try {
        sttResponse = await firstValueFrom(
          this.httpService.post(sttApiEndpoint, formData, {
            headers: formData.getHeaders(),
            timeout: 60000,
          }),
        );
      } catch (err) {
        this.logger.error(`STT service POST error: ${err.message}`);
        if (err.response?.data) {
          this.logger.error(`STT error response: ${JSON.stringify(err.response.data)}`);
        }
        throw err;
      }
      let transcription =
        sttResponse.data.transcription ||
        sttResponse.data.text ||
        (Array.isArray(sttResponse.data.results) && sttResponse.data.results[0]?.text) ||
        null;
      if (!transcription) {
        this.logger.error(`Invalid response from STT service: ${JSON.stringify(sttResponse.data)}`);
        await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.FAILED_STT_SERVICE);
        return;
      }
      this.logger.log(`Transcription received: ${transcription.substring(0, 50)}...`);
      // 4. Natijani MessageLogEntity ga saqlash va LLM navbatiga uzatish
      const updatedLog = await this.messageLoggingService.updateMessageLogWithTranscription(messageLogId, transcription);
      if (updatedLog && updatedLog.sttStatus === SttStatusEnum.COMPLETED) {
        await this.aiQueueService.addLlmAnalysisJob({
          messageLogId,
          textToAnalyze: transcription,
          promptType: 'VOICE_MESSAGE_ANALYSIS',
        });
        await this.messageLoggingService.updateMessageLogLlmStatus(messageLogId, LlmAnalysisStatusEnum.PENDING);
      } else {
        this.logger.warn(`[STT Job ${job.id}] STT result could not be saved or status not COMPLETED for messageLogId: ${messageLogId}. LLM job not added.`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing STT job ${job.id} for messageLogId ${messageLogId}: ${error.message}`,
        error.stack,
      );
      if (error.response) {
        this.logger.error(`STT Service Error Response: ${JSON.stringify(error.response.data)}`);
        await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.FAILED_STT_SERVICE);
      } else if (error.request) {
        await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.FAILED_STT_NO_RESPONSE);
      } else {
        await this.messageLoggingService.updateMessageLogSttStatus(messageLogId, SttStatusEnum.FAILED_UNKNOWN);
      }
      throw error;
    } finally {
      if (localFilePath && fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
          this.logger.log(`Deleted temporary file ${localFilePath}`);
        } catch (unlinkError) {
          this.logger.error(`Failed to delete temporary file ${localFilePath}: ${unlinkError.message}`);
        }
      }
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(
      `Processing job ${job.id} of type ${job.name} with data ${JSON.stringify(job.data)}...`,
    );
  }

  @OnQueueError()
  onError(error: Error) {
    this.logger.error(`Queue error: ${error.message}`, error.stack);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed: ${error.message}`,
      error.stack,
    );
  }
}