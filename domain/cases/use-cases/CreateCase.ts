import { ApplicationState } from '@/application/ApplicationState';
import { DomainEventBus } from '@/application/DomainEventBus';
import type { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import { Case } from '@/domain/cases/entities/Case';
import { Person, type PersonProps } from '@/domain/cases/entities/Person';
import type { CaseStatus } from '@/types/case';
import { createLogger } from '@/utils/logger';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('CreateCaseUseCase');

export interface CreateCaseInput {
  id?: string;
  mcn: string;
  name: string;
  status?: CaseStatus;
  person: PersonProps;
  metadata?: Record<string, unknown>;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/**
 * Use Case: Create a new case
 * Pattern: Validate → Create Entity → Optimistic Update → Persist → Rollback on Error
 */
export class CreateCaseUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly storage: StorageRepository,
    private readonly eventBus: DomainEventBus = DomainEventBus.getInstance(),
  ) {}

  async execute(input: CreateCaseInput): Promise<Case> {
    this.validateInput(input);

    const person = Person.create(input.person);
    const caseEntity = Case.create({
      id: input.id,
      mcn: input.mcn,
      name: input.name,
      status: input.status,
      personId: person.id,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      metadata: input.metadata,
      person,
    });

    logger.info('Creating case', {
      caseId: caseEntity.id,
    });

    this.appState.addCase(caseEntity);

    try {
      await this.storage.cases.save(caseEntity);

      await this.eventBus.publish('CaseCreated', caseEntity.toJSON(), {
        aggregateId: caseEntity.id,
        metadata: { mcn: caseEntity.mcn },
      });

      logger.info('Case persisted successfully', { caseId: caseEntity.id });

      return caseEntity.clone();
    } catch (error) {
      logger.error('Failed to persist case, rolling back', {
        error,
        caseId: caseEntity.id,
      });

      this.appState.removeCase(caseEntity.id);
      throw new DomainError('Failed to create case', { cause: error });
    }
  }

  private validateInput(input: CreateCaseInput): void {
    if (!input.mcn?.trim()) {
      throw new DomainError('MCN is required');
    }

    if (!input.name?.trim()) {
      throw new DomainError('Case name is required');
    }

    if (!input.person?.firstName?.trim()) {
      throw new DomainError('Person first name is required');
    }

    if (!input.person?.lastName?.trim()) {
      throw new DomainError('Person last name is required');
    }
  }
}

export default CreateCaseUseCase;
