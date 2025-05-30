import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionMonitoringService } from './question-monitoring.service';
import { UserChatRoleEntity } from '../user-management/entities/user-chat-role.entity';
import { OllamaModule } from '../ai-processing/ollama/ollama.module';
import { TelegramBaseModule } from '../telegram-base/telegram-base.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserChatRoleEntity]), OllamaModule, forwardRef(() => TelegramBaseModule)],
  providers: [QuestionMonitoringService],
  exports: [QuestionMonitoringService],
})
export class QuestionMonitoringModule {}
