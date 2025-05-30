import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  MinLength,
  MaxLength,
  IsObject,
} from 'class-validator';
import { KpiFrequency } from '../enums/kpi-frequency.enum';
import { KpiStatus } from '../enums/kpi-status.enum';

export class CreateKpiDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  metricName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  metricUnit: string;

  @IsNumber()
  @IsOptional()
  targetValue?: number;

  @IsEnum(KpiFrequency)
  @IsOptional()
  frequency?: KpiFrequency = KpiFrequency.MONTHLY;

  // Status odatda servis tomonidan PENDING_APPROVAL qilib o'rnatiladi, lekin DTOda bo'lishi mumkin
  @IsEnum(KpiStatus)
  @IsOptional()
  status?: KpiStatus;

  @IsDateString()
  @IsOptional()
  startDate?: string; // ISO8601 formatidagi sana

  @IsDateString()
  @IsOptional()
  endDate?: string; // ISO8601 formatidagi sana

  // createdById servis tomonidan o'rnatiladi

  @IsObject()
  @IsOptional()
  additionalConfig?: Record<string, any>;
}
