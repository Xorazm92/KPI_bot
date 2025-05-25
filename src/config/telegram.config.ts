import { registerAs } from '@nestjs/config';

export default registerAs('telegram', () => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
  }

  return {
    botToken,
    botName: process.env.TELEGRAM_BOT_NAME || 'FincoKpiBot',
  };
});
