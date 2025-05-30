import { PartialType } from '@nestjs/mapped-types';
import { CreateKpiDefinitionDto } from './create-kpi-definition.dto';

export class UpdateKpiDefinitionDto extends PartialType(
  CreateKpiDefinitionDto,
) {}
