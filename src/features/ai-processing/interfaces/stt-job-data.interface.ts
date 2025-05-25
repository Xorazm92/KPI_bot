export interface SttJobData {
  messageLogId: string;
  audioFileId: string;
  chatId?: number; // Optional: if needed for context later
  telegramUserId?: number; // Optional: if needed for context later
}
