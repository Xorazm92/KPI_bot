import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { InjectBot } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TelegramBaseService {
  private readonly logger = new Logger(TelegramBaseService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<any>,
    private readonly configService: ConfigService,
  ) {}

  async sendMessage(
    chatId: number | string,
    text: string,
    extra?: any,
  ): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, text, extra);
    } catch (error) {
      this.logger.error(
        `Failed to send message to ${chatId}: ${error.message}`,
        error.stack,
      );
      // Potentially re-throw or handle specific errors (e.g., bot blocked by user)
    }
  }

  async getFileLink(fileId: string): Promise<string> {
    try {
      return (await this.bot.telegram.getFileLink(fileId)).href;
    } catch (error) {
      this.logger.error(
        `Failed to get file link for ${fileId}: ${error.message}`,
        error.stack,
      );
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

  async downloadFile(fileUrl: string, localPath: string): Promise<void> {
    this.logger.log(
      `Attempting to download file from ${fileUrl} to ${localPath}`,
    );
    try {
      // Ensure the directory exists
      const dirname = path.dirname(localPath);
      await fs.promises.mkdir(dirname, { recursive: true });

      const writer = fs.createWriteStream(localPath);
      const response = await axios({
        url: fileUrl,
        method: 'GET',
        responseType: 'stream',
      });

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          this.logger.log(`File successfully downloaded to ${localPath}`);
          resolve();
        });
        writer.on('error', (error) => {
          this.logger.error(
            `Error writing file to ${localPath}: ${error.message}`,
            error.stack,
          );
          // Attempt to clean up partially written file
          fs.unlink(localPath, (unlinkErr) => {
            if (unlinkErr)
              this.logger.error(
                `Failed to unlink partial file ${localPath}: ${unlinkErr.message}`,
              );
          });
          reject(new Error(`Failed to write file: ${error.message}`));
        });
        response.data.on('error', (error) => {
          // Handle stream errors from axios
          this.logger.error(
            `Error in download stream from ${fileUrl}: ${error.message}`,
            error.stack,
          );
          writer.close(); // Close writer to prevent further issues
          reject(new Error(`Download stream error: ${error.message}`));
        });
      });
    } catch (error) {
      this.logger.error(
        `Failed to download file from ${fileUrl}: ${error.message}`,
        error.stack,
      );
      // Check if it's an axios error to provide more details
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(
          `Axios error details: status=${error.response.status}, data=${JSON.stringify(error.response.data)}`,
        );
        throw new Error(
          `Failed to download file: ${error.response.status} - ${error.message}`,
        );
      }
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }
}
