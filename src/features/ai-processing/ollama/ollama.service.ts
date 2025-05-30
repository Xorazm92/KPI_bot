import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly ollamaUrl: string;
  private readonly model: string;

  constructor(private readonly httpService: HttpService) {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'qwen-ozbek';
  }

  async generateContent(prompt: string): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.ollamaUrl}/api/generate`, {
          model: this.model,
          prompt,
          stream: false,
        })
      );
      // Ollama returns { response: '...javob...' }
      return response.data.response || '';
    } catch (error) {
      this.logger.error(`Ollama bilan so'rovda xatolik: ${error.message}`);
      throw new Error("Ollama bilan bog'lanib bo'lmadi yoki model xato ishlamoqda.");
    }
  }
}
