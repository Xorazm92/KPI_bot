import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { MessageLoggingService } from '../message-logging/message-logging.service';
import { LlmJobData } from './interfaces/llm-job-data.interface';
import { LlmAnalysisStatusEnum } from './enums/llm-analysis-status.enum';

@Processor('llm-analysis-queue')
export class LlmProcessor {
  private readonly logger = new Logger(LlmProcessor.name);
  private readonly ollamaBaseUrl: string;
  private readonly ollamaModel: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly messageLoggingService: MessageLoggingService,
  ) {
    this.ollamaBaseUrl = this.configService.get<string>(
      'OLLAMA_BASE_URL',
      'http://localhost:11434',
    );
    // .env faylida OLLAMA_QWEN_MODEL ni sozlash tavsiya etiladi
    this.ollamaModel = this.configService.get<string>(
      'OLLAMA_MODEL',
      'qwen-ozbek',
    );
  }

  @Process('analyze-text') // Vazifa nomi
  async handleAnalyzeText(job: Job<LlmJobData>): Promise<void> {
    const { messageLogId, textToAnalyze, promptType } = job.data;
    this.logger.log(
      `[LLM Job ${job.id}] Processing messageLogId: ${messageLogId}, promptType: ${promptType}`,
    );

    await this.messageLoggingService.updateMessageLogLlmStatus(
      messageLogId,
      LlmAnalysisStatusEnum.PROCESSING,
    );

    // TODO: Promptni promptType ga qarab dinamik generatsiya qilish kerak
    // Hozircha oddiy prompt ishlatamiz
    const prompt = `Analyze the following text and provide insights based on the type '${promptType}':\n\nText: "${textToAnalyze}"\n\nInsights:`;

    try {
      const ollamaApiUrl = `${this.ollamaBaseUrl}/api/generate`;
      const requestBody = {
        model: this.ollamaModel,
        prompt: prompt,
        stream: false, // Javobni to'liq olish uchun
      };

      this.logger.debug(
        `[LLM Job ${job.id}] Sending request to Ollama: ${ollamaApiUrl}, model: ${this.ollamaModel}`,
      );

      const response = await firstValueFrom(
        this.httpService.post(ollamaApiUrl, requestBody),
      );

      if (response.data && response.data.response) {
        const llmRawResponse = response.data.response;
        this.logger.log(
          `[LLM Job ${job.id}] Received response from Ollama for messageLogId: ${messageLogId}`,
        );
        // TODO: Javobni strukturalash logikasi kerak bo'lishi mumkin
        await this.messageLoggingService.updateMessageLogWithLlmResult(
          messageLogId,
          promptType,
          prompt, // Yuborilgan to'liq prompt
          llmRawResponse,
          response.data, // Xom javobni ham saqlashimiz mumkin
        );
      } else {
        this.logger.error(
          `[LLM Job ${job.id}] Invalid response structure from Ollama: ${JSON.stringify(response.data)}`,
        );
        await this.messageLoggingService.updateMessageLogLlmStatus(
          messageLogId,
          LlmAnalysisStatusEnum.FAILED_LLM_PROCESSING,
        );
      }
    } catch (error) {
      this.logger.error(
        `[LLM Job ${job.id}] Error calling Ollama service for messageLogId ${messageLogId}: ${error.message}`,
        error.stack,
      );
      await this.messageLoggingService.updateMessageLogLlmStatus(
        messageLogId,
        LlmAnalysisStatusEnum.FAILED_LLM_SERVICE,
      );
    }
  }
}
