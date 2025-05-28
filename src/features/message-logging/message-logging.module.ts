import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageLogEntity } from './entities/message-log.entity';
import { MessageLoggingService } from './message-logging.service';
import { UserManagementModule } from '../user-management/user-management.module';
import { ResponseTimeModule } from '../response-time/response-time.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageLogEntity]),
    forwardRef(() => UserManagementModule),
    // forwardRef(() => ResponseTimeModule), // Temporarily removed
  ],
  providers: [MessageLoggingService],
  exports: [MessageLoggingService, TypeOrmModule],
})
export class MessageLoggingModule {}
