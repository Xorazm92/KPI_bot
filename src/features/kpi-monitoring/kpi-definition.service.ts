import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOneOptions } from 'typeorm';
import { KpiDefinitionEntity } from './entities/kpi-definition.entity';
import { UserEntity } from '../user-management/entities/user.entity';
import { KpiStatus } from './enums/kpi-status.enum';
import { CreateKpiDefinitionDto } from './dto/create-kpi-definition.dto';
import { UpdateKpiDefinitionDto } from './dto/update-kpi-definition.dto';

@Injectable()
export class KpiDefinitionService {
  private readonly logger = new Logger(KpiDefinitionService.name);

  constructor(
    @InjectRepository(KpiDefinitionEntity)
    private readonly kpiDefinitionRepository: Repository<KpiDefinitionEntity>,
  ) {}

  async createKpiDefinition(
    createKpiDefinitionDto: CreateKpiDefinitionDto,
    creator: UserEntity,
  ): Promise<KpiDefinitionEntity> {
    const newKpi = this.kpiDefinitionRepository.create({
      ...createKpiDefinitionDto,
      createdById: creator.id,
      status: createKpiDefinitionDto.status || KpiStatus.PENDING_APPROVAL,
      startDate: createKpiDefinitionDto.startDate ? new Date(createKpiDefinitionDto.startDate) : undefined,
      endDate: createKpiDefinitionDto.endDate ? new Date(createKpiDefinitionDto.endDate) : undefined,
    });

    this.logger.log(`Creating new KPI Definition: ${createKpiDefinitionDto.name} by user ${creator.telegramId}`);
    return this.kpiDefinitionRepository.save(newKpi);
  }

  async findAllKpiDefinitions(): Promise<KpiDefinitionEntity[]> {
    this.logger.log('Fetching all KPI Definitions');
    return this.kpiDefinitionRepository.find({ relations: ['createdBy', 'approvedBy'] });
  }

  async findKpiDefinitionById(id: string, options?: FindOneOptions<KpiDefinitionEntity>): Promise<KpiDefinitionEntity | null> {
    this.logger.log(`Fetching KPI Definition with ID: ${id}`);
    const kpi = await this.kpiDefinitionRepository.findOne({ where: { id }, ...options });
    if (!kpi) {
      this.logger.warn(`KPI Definition with ID: ${id} not found`);
    }
    return kpi;
  }

  async findKpiDefinitionByIdOrFail(id: string, options?: FindOneOptions<KpiDefinitionEntity>): Promise<KpiDefinitionEntity> {
    const kpi = await this.findKpiDefinitionById(id, options);
    if (!kpi) {
      throw new NotFoundException(`KPI Definition with ID ${id} not found`);
    }
    return kpi;
  }

  async updateKpiDefinition(id: string, updateKpiDefinitionDto: UpdateKpiDefinitionDto): Promise<KpiDefinitionEntity> {
    const kpi = await this.findKpiDefinitionByIdOrFail(id);

    const { startDate: startDateString, endDate: endDateString, ...restOfDto } = updateKpiDefinitionDto;

    const updatePayload: Partial<KpiDefinitionEntity> = {
      ...restOfDto,
    };

    if (startDateString) {
      updatePayload.startDate = new Date(startDateString);
    }
    if (endDateString) {
      updatePayload.endDate = new Date(endDateString);
    }

    Object.keys(updatePayload).forEach(key => {
      if (updatePayload[key] === undefined) {
        delete updatePayload[key];
      }
    });

    this.kpiDefinitionRepository.merge(kpi, updatePayload);
    this.logger.log(`Updating KPI Definition with ID: ${id}`);
    return this.kpiDefinitionRepository.save(kpi);
  }

  async approveKpiDefinition(id: string, approver: UserEntity): Promise<KpiDefinitionEntity> {
    const kpi = await this.findKpiDefinitionByIdOrFail(id);
    kpi.status = KpiStatus.ACTIVE;
    kpi.approvedById = approver.id;
    kpi.approvedBy = approver;
    this.logger.log(`KPI Definition ${id} approved by user ${approver.telegramId}`);
    return this.kpiDefinitionRepository.save(kpi);
  }
}
