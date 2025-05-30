import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { KpiReportService } from './kpi-report.service';
import { KpiReportEntity, KpiReportStatus } from './entities/kpi-report.entity';
// import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../../core/auth/guards/roles.guard';
// import { Roles } from '../../core/auth/decorators/roles.decorator';
import { UserRole } from '@common/enums/user-role.enum';
// import {
//   ApiBearerAuth,
//   ApiOperation,
//   ApiResponse,
//   ApiTags,
// import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

// @ApiTags('kpi-reports')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard)

@Controller('kpi-reports')
export class KpiReportController {
  constructor(private readonly kpiReportService: KpiReportService) {}

  @Post()
  // @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  // @ApiOperation({ summary: 'Yangi KPI hisoboti yaratish' })
  // @ApiResponse({ status: 201, description: 'Hisobot muvaffaqiyatli yaratildi' })
  async createReport(
    @Req() req: any,
    @Body() data: any,
  ): Promise<KpiReportEntity> {
    return this.kpiReportService.createReport(req.user.userId, data);
  }

  @Get('my-reports')
  // @ApiOperation({ summary: "Foydalanuvchining o'z hisobotlari" })
  // @ApiResponse({ status: 200, description: 'Foydalanuvchi hisobotlari' })
  async getMyReports(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<KpiReportEntity[]> {
    return this.kpiReportService.getUserReports(
      req.user.userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('all')
  // @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  // @ApiOperation({
//   summary: "Barcha hisobotlarni ko'rish (admin/supervisor uchun)",
// })
  // @ApiResponse({ status: 200, description: "Barcha hisobotlar ro'yxati" })
  async getAllReports(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userIds') userIds?: string,
    @Query('status') status?: KpiReportStatus,
  ): Promise<KpiReportEntity[]> {
    return this.kpiReportService.getAllReports(req.user.userId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      userIds: userIds ? userIds.split(',') : undefined,
      status,
    });
  }

  @Get('stats/:userId')
  // @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  // @ApiOperation({ summary: 'Xodim statistikasi' })
  // @ApiResponse({ status: 200, description: 'Xodim statistikasi' })
  async getUserStats(
    @Param('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.kpiReportService.getUserStats(
      userId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Post('publish/:id')
  // @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  // @ApiOperation({ summary: 'Hisobotni nashr qilish' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Hisobot muvaffaqiyatli nashr qilindi',
  // })
  async publishReport(
    @Req() req: any,
    @Param('id') reportId: string,
  ): Promise<KpiReportEntity> {
    return this.kpiReportService.publishReport(reportId, req.user.userId);
  }

  @Get('my-stats')
  // @ApiOperation({ summary: 'Shaxsiy statistikalar' })
  // @ApiResponse({ status: 200, description: 'Foydalanuvchi statistikasi' })
  async getMyStats(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.kpiReportService.getUserStats(
      req.user.userId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}
