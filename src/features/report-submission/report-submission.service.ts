import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportSubmissionEntity } from './entities/report-submission.entity';
import { ReportStatus } from './enums/report-status.enum';
import { ReportTypeEntity, ReportFrequency } from './entities/report-type.entity';
import { UserEntity } from '../user-management/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { Chat as TelegrafChat, Message as TelegrafMessage } from 'telegraf/types';

@Injectable()
export class ReportSubmissionService {
  private readonly logger = new Logger(ReportSubmissionService.name);

  constructor(
    @InjectRepository(ReportSubmissionEntity)
    private readonly reportSubmissionRepository: Repository<ReportSubmissionEntity>,
    @InjectRepository(ReportTypeEntity)
    private readonly reportTypeRepository: Repository<ReportTypeEntity>,
  ) {}

  async handleReportSubmission(
    user: UserEntity,
    chat: TelegrafChat,
    message: TelegrafMessage & { document?: any },
    userRoleInChat: UserRole,
    reportCode?: string,
  ): Promise<ReportSubmissionEntity | null> {
    this.logger.log(
      `Handling report submission for user ${user.telegramId} (Role: ${userRoleInChat}) in chat ${chat.id}, code: ${reportCode}, file: ${message.document?.file_name}`,
    );

    let reportType: ReportTypeEntity | null = null;

    // 1. Hisobot turini aniqlash
    if (reportCode) {
      reportType = await this.reportTypeRepository.findOne({ where: { code: reportCode, isActive: true } });
      if (!reportType) {
        this.logger.warn(`Report type with code '${reportCode}' not found or not active.`);
        // Foydalanuvchiga xabar yuborish kerak (Update qismida)
        // throw new NotFoundException(`Hisobot turi '${reportCode}' topilmadi.`);
        return null;
      }
    } else if (message.document) {
      // TODO: Fayl nomi yoki xeshteglar bo'yicha hisobot turini aniqlash
      this.logger.warn('Report submission by file without report code is not yet fully implemented for type detection.');
      // Misol uchun, agar birinchi topilgan aktiv hisobotni olsak (bu yaxshi yechim emas)
      // reportType = await this.reportTypeRepository.findOne({ where: { isActive: true } }); 
      // if (!reportType) {
      //   this.logger.error('No active report types found for file submission without code.');
      //   return null;
      // }
      return null; // Hozircha faqat kod bilan ishlaymiz
    } else {
      this.logger.warn('No report code or file provided for submission.');
      return null;
    }

    this.logger.log(`Identified report type: ${reportType.name} (ID: ${reportType.id})`);

    // 2. Foydalanuvchi rolini tekshirish
    if (reportType.responsibleRoles && reportType.responsibleRoles.length > 0) {
      const userRole = userRoleInChat;
      if (!userRole || !reportType.responsibleRoles.includes(userRole)) {
        this.logger.warn(
          `User ${user.telegramId} (Role: ${userRole}) is not authorized to submit report ${reportType.code}. Allowed roles: ${reportType.responsibleRoles.join(', ')}`,
        );
        // throw new ForbiddenException('Sizda bu hisobotni topshirish uchun ruxsat yo\'q.');
        return null;
      }
    }

    // 3. Muddatni tekshirish (Deadline Calculation)
    const submissionTimestamp = new Date(message.date * 1000);
    const deadlineFromCalc = this.calculateDeadline(reportType, submissionTimestamp);

    // ReportSubmissionEntity yaratish va saqlash
    const newReportSubmissionData: Partial<ReportSubmissionEntity> = {
      submittedByUser: user,
      reportType: reportType,
      // chatId: chat.id, // Vaqtinchalik kommentga olindi, agar entityda bo'lmasa
      telegramFileId: message.document?.file_id,
      description: (message as any).caption,
      submittedAt: submissionTimestamp,
      status: ReportStatus.SUBMITTED,
    };

    if (deadlineFromCalc) { 
      if (submissionTimestamp <= deadlineFromCalc) {
        newReportSubmissionData.status = ReportStatus.SUBMITTED;
      } else {
        newReportSubmissionData.status = ReportStatus.SUBMITTED;
      }
    }
    
    const newReportSubmission: ReportSubmissionEntity = this.reportSubmissionRepository.create(newReportSubmissionData);

    try {
      const savedReportSubmission: ReportSubmissionEntity = await this.reportSubmissionRepository.save(newReportSubmission);
      this.logger.log(
        `Report submission (ID: ${savedReportSubmission.id}) saved for report type ${reportType.code} by user ${user.telegramId}. Status: ${savedReportSubmission.status}`,
      );
      return savedReportSubmission;
    } catch (error) {
      this.logger.error(`Error saving report submission for report type ${reportType.code}: ${error.message}`, error.stack);
      return null;
    }
  }

  private calculateDeadline(reportType: ReportTypeEntity, submissionDate: Date): Date | null {
    // Bu metod hozircha juda sodda. Kelajakda murakkablashtiriladi.
    // Masalan, reportType.deadlineRule (e.g., 'MONTHLY:5:18:00' - har oyning 5-kuni soat 18:00)
    // yoki reportType.frequency ga qarab hisoblash kerak.

    this.logger.debug(`Calculating deadline for report type: ${reportType.code}, frequency: ${reportType.frequency}`);

    if (!reportType.deadlineRule && reportType.frequency === ReportFrequency.ADHOC) {
        this.logger.log(`Report type ${reportType.code} is ADHOC and has no specific deadline rule. No deadline will be set.`);
        return null; // Maxsus topshiriqlar uchun muddat bo'lmasligi mumkin
    }

    // Oddiy misol: Agar 'DAILY' bo'lsa, o'sha kunning oxirigacha (23:59:59)
    // Bu faqat namuna, haqiqiy logika ancha murakkab bo'ladi.
    if (reportType.frequency === ReportFrequency.DAILY) {
      const deadline = new Date(submissionDate);
      deadline.setHours(23, 59, 59, 999);
      this.logger.log(`Calculated deadline for DAILY report ${reportType.code}: ${deadline.toISOString()}`);
      return deadline;
    }

    // Agar 'MONTHLY' va deadlineRule 'EOM' (End Of Month) bo'lsa
    if (reportType.frequency === ReportFrequency.MONTHLY && reportType.deadlineRule?.toUpperCase() === 'EOM') {
        const deadline = new Date(submissionDate.getFullYear(), submissionDate.getMonth() + 1, 0); // Oyning oxirgi kuni
        deadline.setHours(23, 59, 59, 999);
        this.logger.log(`Calculated deadline for MONTHLY (EOM) report ${reportType.code}: ${deadline.toISOString()}`);
        return deadline;
    }
    
    // TODO: Boshqa frequency va deadlineRule lar uchun logikani qo'shish
    this.logger.warn(`Deadline calculation logic for frequency '${reportType.frequency}' and rule '${reportType.deadlineRule}' is not yet implemented. No deadline will be set.`);
    return null;
  }
}
