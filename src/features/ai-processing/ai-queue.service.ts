import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SttJobData } from './interfaces/stt-job-data.interface';
import { LlmJobData } from './interfaces/llm-job-data.interface';

@Injectable()
export class AiQueueService {
  private readonly logger = new Logger(AiQueueService.name);

  constructor(
    @InjectQueue('stt-queue') private readonly sttQueue: Queue<SttJobData>,
    @InjectQueue('llm-analysis-queue') private readonly llmAnalysisQueue: Queue<LlmJobData>,
  ) {}

  async addSttJob(data: SttJobData): Promise<void> {
    try {
      const job = await this.sttQueue.add('transcribe-audio', data, {
        attempts: 3, 
        backoff: {
          type: 'exponential',
          delay: 5000, 
        },
        removeOnComplete: true,
        removeOnFail: 50, 
      });
      this.logger.log(
        `Added STT job ${job.id} for messageLogId: ${data.messageLogId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error adding STT job for messageLogId ${data.messageLogId}: ${error.message}`,
        error.stack,
      );
      // Bu yerda messageLog da statusni FAILED_QUEUE ga o'zgartirish mumkin
    }
  }

  async addLlmAnalysisJob(data: LlmJobData): Promise<void> {
    try {
      const job = await this.llmAnalysisQueue.add('analyze-text', data, {
        attempts: 2, 
        backoff: {
          type: 'exponential',
          delay: 10000, 
        },
        removeOnComplete: true,
        removeOnFail: 50,
      });
      this.logger.log(
        `Added LLM analysis job ${job.id} for messageLogId: ${data.messageLogId}, promptType: ${data.promptType}`,
      );
    } catch (error) {
      this.logger.error(
        `Error adding LLM analysis job for messageLogId ${data.messageLogId}: ${error.message}`,
        error.stack,
      );
      // Bu yerda messageLog da llm_analysis_status ni FAILED_QUEUE ga o'zgartirish mumkin
      // Masalan, messageLoggingService.updateMessageLogLlmStatus(data.messageLogId, LlmAnalysisStatusEnum.FAILED_QUEUE)
      // Buning uchun MessageLoggingService ni bu servisga inject qilish kerak bo'ladi.
    }
  }
}
