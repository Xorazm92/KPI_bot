import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { InjectBot } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramBaseService {
  private readonly logger = new Logger(TelegramBaseService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<any>,
    private readonly configService: ConfigService,
  ) {}

  async sendMessage(chatId: number | string, text: string, extra?: any): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, text, extra);
    } catch (error) {
      this.logger.error(`Failed to send message to ${chatId}: ${error.message}`, error.stack);
      // Potentially re-throw or handle specific errors (e.g., bot blocked by user)
    }
  }

  async getFileLink(fileId: string): Promise<string> {
    try {
      return (await this.bot.telegram.getFileLink(fileId)).href;
    } catch (error) {
      this.logger.error(`Failed to get file link for ${fileId}: ${error.message}`, error.stack);
      throw error; // Re-throw to be handled by caller
    }
  }
  public async getChatInfo(chatId: number) {
    return this.bot.telegram.getChat(chatId);
  }

  // Add more Telegraf functionalities as needed, e.g.:
  // - sendPhoto, sendDocument, sendAudio, etc.
  // - editMessageText, deleteMessage
  // - getChatMember, getChatAdministrators
  // - leaveChat, kickChatMember

  async getBotUsername(): Promise<string> {
    const me = await this.bot.telegram.getMe();
    return me.username;
  }
}
