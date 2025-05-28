import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan, IsNull, Not } from 'typeorm';
// import { QuestionStatus } from '../message-logging/entities/message-log.entity'; // Temporarily commented out
import { MessageLogEntity } from '../message-logging/entities/message-log.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ResponseTimeService {
  private readonly logger = new Logger(ResponseTimeService.name);
  private readonly clientQuestionTimeoutMinutes: number;
  private readonly agentResponseTimeoutMinutes: number;

  constructor(
    @InjectRepository(MessageLogEntity)
    private readonly messageLogRepository: Repository<MessageLogEntity>,
    private readonly configService: ConfigService,
  ) {
    this.clientQuestionTimeoutMinutes = this.configService.get<number>('CLIENT_QUESTION_TIMEOUT_MINUTES', 10);
    this.agentResponseTimeoutMinutes = this.configService.get<number>('AGENT_RESPONSE_TIMEOUT_MINUTES', 5);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleTimedOutClientQuestions() {
    this.logger.debug('Running cron job: handleTimedOutClientQuestions');
    // const timeoutThreshold = new Date(Date.now() - this.clientQuestionTimeoutMinutes * 60 * 1000);

    // const pendingClientQuestions = await this.messageLogRepository.find({
    //   where: {
    //     isQuestion: true,
    //     // questionStatus: QuestionStatus.PENDING, // Temporarily commented out
    //     questionStatusTemp: 'PENDING', // Using temp field
    //     directionTemp: 'INCOMING',
    //     timestamp: LessThan(timeoutThreshold),
    //     // For filtering by user role, you'd need a subquery or filter after fetching if using TypeORM query builder directly for many-to-many
    //     // Example post-fetch filter:
    //     // user: { chatRoles: { role: UserRole.CLIENT } } // This specific syntax might not work directly in `find` options for complex relations
    //   },
    //   relations: ['user', 'user.chatRoles', 'user.chatRoles.role'], // Ensure relations are loaded
    // });

    // for (const question of pendingClientQuestions) {
    //   // if (question.user && question.user.chatRoles && question.user.chatRoles.some(chatRole => chatRole.role === UserRole.CLIENT)) { // Check role correctly
    //   //   this.logger.log(`Client question ID ${question.id} from user ${question.user.telegramId} has timed out.`);
    //   //   // question.questionStatus = QuestionStatus.TIMEOUT_CLIENT; // Temporarily commented out
    //   //   question.questionStatusTemp = 'TIMEOUT_CLIENT'; // Using temp field
    //   //   await this.messageLogRepository.save(question);
    //   // }
    // }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleTimedOutAgentResponses() {
    this.logger.debug('Running cron job: handleTimedOutAgentResponses');
    // const timeoutThreshold = new Date(Date.now() - this.agentResponseTimeoutMinutes * 60 * 1000);
    // const pendingAgentQuestions = await this.messageLogRepository.find({
    //   where: {
    //     isQuestion: true,
    //     // questionStatus: QuestionStatus.PENDING, // Temporarily commented out
    //     questionStatusTemp: 'PENDING',
    //     timestamp: LessThan(timeoutThreshold),
    //   },
    //   relations: ['user', 'user.chatRoles', 'user.chatRoles.role'],
    // });

    // for (const question of pendingAgentQuestions) {
    //   this.logger.log(`Agent response for question ID ${question.id} (originally from ${question.user?.telegramId}) may be timed out.`);
    //   // question.questionStatus = QuestionStatus.TIMEOUT_AGENT; // Temporarily commented out
    //   question.questionStatusTemp = 'TIMEOUT_AGENT';
    //   // await this.messageLogRepository.save(question);
    // }
  }

  async checkForUnansweredFollowUps(messageLog: MessageLogEntity) {
    if (!messageLog.user || !messageLog.user.chatRoles || !messageLog.user.chatRoles.some(chatRole => chatRole.role === UserRole.CLIENT) || !messageLog.isQuestion) {
      return;
    }

    // const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    // const recentAnsweredQuestions = await this.messageLogRepository.find({
    //   where: {
    //     chatId: messageLog.chatId,
    //     user: { id: messageLog.user.id }, 
    //     isQuestion: true,
    //     // questionStatus: QuestionStatus.ANSWERED, // Temporarily commented out
    //     questionStatusTemp: 'ANSWERED',
    //     timestamp: MoreThan(fiveMinutesAgo),
    //     id: Not(messageLog.id),
    //   },
    //   order: { timestamp: 'DESC' },
    //   take: 1,
    //   relations: ['user'], 
    // });

    // if (recentAnsweredQuestions.length > 0) {
    //   const lastAnsweredQuestion = recentAnsweredQuestions[0];
    //   this.logger.log(
    //     `Client ${messageLog.user.telegramId} sent a new message (ID: ${messageLog.id}) after a recent answered question (ID: ${lastAnsweredQuestion.id}). This might be a follow-up.`, 
    //   );
    // }
  }
}
