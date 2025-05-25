import { Module, Logger, forwardRef } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Agent as HttpsAgentStandard } from 'https';
import TelegrafSessionLocal from 'telegraf-session-local';
import { TelegramBaseService } from './telegram-base.service';
import { TelegramBaseUpdate } from './telegram-base.update';
import { UserManagementModule } from '../user-management/user-management.module';
import { UserManagementService } from '../user-management/user-management.service';
import { MessageLoggingModule } from '../message-logging/message-logging.module';
import { KpiMonitoringModule } from '../kpi-monitoring/kpi-monitoring.module';
import { UserSessionMiddleware } from '../../common/middlewares/user-session.middleware';

@Module({
  imports: [
    ConfigModule,
    TelegrafModule.forRootAsync({
      imports: [ConfigModule, UserManagementModule],
      useFactory: async (configService: ConfigService, userManagementService: UserManagementService) => {
        const logger = new Logger('TelegramBaseModuleFactory');
        const token = configService.get<string>('telegram.botToken');

        if (!token) {
          logger.error('[TelegramBaseModuleFactory] CRITICAL: Telegram Bot Token is UNDEFINED in ConfigService. Application cannot start.');
          throw new Error('Telegram Bot Token is missing. Check your .env file or environment variables.');
        }

        const botName = configService.get<string>('telegram.botName') || 'FincoKpiBot';

        const agent = new HttpsAgentStandard({
          keepAlive: true,
          timeout: 25000,
          family: 4,
        });

        logger.log(`[TelegramBaseModuleFactory] Created HttpsAgent with family: 4`);

        const sessionMiddleware = new TelegrafSessionLocal({ database: 'session_db.json' }).middleware();
        const userSessionMiddlewareInstance = new UserSessionMiddleware(userManagementService);

        const telegrafModuleOptions = {
          token,
          botName,
          middlewares: [
            sessionMiddleware, 
            (ctx, next) => userSessionMiddlewareInstance.use(ctx, next)
          ],
          options: {
            handlerTimeout: 30000,
            telegram: {
              agent,
              apiRoot: 'https://api.telegram.org',
              timeout: 25000,
            },
          },
        };

        logger.log(`[TelegramBaseModuleFactory] Initializing Telegraf with token: Token ${token ? 'Present' : 'MISSING'} (first 10 chars: ${token.substring(0, 10)}...)`);
        logger.log('[TelegramBaseModuleFactory] Telegraf module options being returned:', JSON.stringify(telegrafModuleOptions, (key, value) => {
          if (key === 'agent') return '[HttpsAgent instance]';
          if (typeof value === 'function') return '[Function]';
          return value;
        }, 2));

        return telegrafModuleOptions;
      },
      inject: [ConfigService, UserManagementService],
    }),
    UserManagementModule,
    MessageLoggingModule,
    KpiMonitoringModule,
  ],
  providers: [TelegramBaseService, TelegramBaseUpdate, UserSessionMiddleware],
  exports: [TelegramBaseService],
})
export class TelegramBaseModule {}
