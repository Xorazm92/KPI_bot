import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch'; 
import * as https from 'https'; 

// Test function for direct fetch
async function testTelegramConnection() {
  console.log('[MainTS-Test] Attempting direct fetch to Telegram API...');
  const botToken = process.env.TELEGRAM_BOT_TOKEN; 
  if (!botToken) {
    console.error('[MainTS-Test] TELEGRAM_BOT_TOKEN is not set in environment for direct test.');
    return;
  }
  const url = `https://api.telegram.org/bot${botToken}/getMe`;
  const agent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 10000,
    family: 4, 
  });

  try {
    const response = await fetch(url, { agent });
    const data = await response.json();
    console.log('[MainTS-Test] Direct fetch response status:', response.status);
    console.log('[MainTS-Test] Direct fetch response data:', data);
    if (!response.ok) {
      console.error('[MainTS-Test] Direct fetch failed:', data);
    }
  } catch (error) {
    console.error('[MainTS-Test] Direct fetch CRITICAL ERROR:', error);
  }
}

async function bootstrap() {
  // Run the direct test before bootstrapping NestJS
  await testTelegramConnection(); 
  console.log('[MainTS-Bootstrap] Proceeding to bootstrap NestJS application...');

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('APP_PORT') || 3001;

  await app.listen(port);
}
bootstrap();
