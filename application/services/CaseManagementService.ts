import { CreateCaseUseCase } from '@/domain/cases/use-cases/CreateCase';
import { UpdateCaseUseCase } from '@/domain/cases/use-cases/UpdateCase';
import { DeleteCaseUseCase } from '@/domain/cases/use-cases/DeleteCase';
import { GetAllCasesUseCase } from '@/domain/cases/use-cases/GetAllCases';
import { ApplicationState } from '@/application/ApplicationState';
import { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import { Case } from '@/domain/cases/entities/Case';
import type { PersonProps } from '@/domain/cases/entities/Person';
import { createLogger } from '@/utils/logger';
import { toast } from 'sonner';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('CaseManagementService');

export interface CreateCaseData {
  mcn: string;
  name: string;
  person: PersonProps;
  metadata?: Record<string, unknown>;
}

export interface UpdateCaseData {
  mcn?: string;
  name?: string;
  person?: Partial<PersonProps>;
  status?: 'Active' | 'Pending' | 'Closed' | 'Archived';
  metadata?: Record<string, unknown>;
}

/**
 * Service Layer: Orchestrates case management use cases
 * 
 * Responsibilities:
 * - Coordinate multiple use cases for complex workflows
 * - Handle UI feedback (toasts, loading states)
 * - Translate between UI types and domain types
 * - Provide simplified API for React hooks
 */
export class CaseManagementService {
  private readonly createCase: CreateCaseUseCase;
  private readonly updateCase: UpdateCaseUseCase;
  private readonly deleteCase: DeleteCaseUseCase;
  private readonly getAllCases: GetAllCasesUseCase;

  constructor(
    private readonly appState: ApplicationState,
    private readonly storage: StorageRepository,
  ) {
    this.createCase = new CreateCaseUseCase(appState, storage);
    this.updateCase = new UpdateCaseUseCase(appState, storage);
    this.deleteCase = new DeleteCaseUseCase(appState, storage);
    this.getAllCases = new GetAllCasesUseCase(appState, storage);
  }

  /**
   * Load all cases from storage
   */
  async loadCases(): Promise<Case[]> {
    try {
      const cases = await this.getAllCases.execute();
      logger.info('Cases loaded', { count: cases.length });
      return cases;
    } catch (error) {
      logger.error('Failed to load cases', { error });
      throw error;
    }
  }

  /**
   * Create a new case with UI feedback
   */
  async createCaseWithFeedback(data: CreateCaseData): Promise<Case> {
    const toastId = toast.loading('Creating case...');

    try {
      const newCase = await this.createCase.execute(data);

      toast.success(
        `Case for ${data.person.firstName} ${data.person.lastName} created successfully`,
        { id: toastId }
      );

      logger.info('Case created successfully', { caseId: newCase.id });
      return newCase;
    } catch (error) {
      const errorMsg = error instanceof DomainError ? error.message : 'Failed to create case';
      logger.error('Failed to create case', { error });
      toast.error(errorMsg, { id: toastId });
      throw error;
    }
  }

  /**
   * Update an existing case with UI feedback
   */
  async updateCaseWithFeedback(caseId: string, updates: UpdateCaseData): Promise<Case> {
    const toastId = toast.loading('Updating case...');

    try {
      const updatedCase = await this.updateCase.execute({ caseId, updates });

      toast.success('Case updated successfully', { id: toastId });

      logger.info('Case updated successfully', { caseId });
      return updatedCase;
    } catch (error) {
      const errorMsg = error instanceof DomainError ? error.message : 'Failed to update case';
      logger.error('Failed to update case', { caseId, error });
      toast.error(errorMsg, { id: toastId });
      throw error;
    }
  }

  /**
   * Update case status with UI feedback
   */
  async updateCaseStatus(
    caseId: string,
    status: 'Active' | 'Pending' | 'Closed' | 'Archived'
  ): Promise<Case> {
    const toastId = toast.loading('Updating case status...');

    try {
      const updatedCase = await this.updateCase.execute({
        caseId,
        updates: { status },
      });

      toast.success(`Status updated to ${status}`, { id: toastId, duration: 2000 });

      logger.info('Case status updated', { caseId, status });
      return updatedCase;
    } catch (error) {
      // Handle AbortError specially (user cancelled)
      if (error instanceof Error && error.name === 'AbortError') {
        toast.dismiss(toastId);
        throw error;
      }

      // Check if it's a DomainError wrapping an AbortError
      if (error instanceof DomainError) {
        const cause = error.cause;
        if (cause instanceof Error && cause.name === 'AbortError') {
          toast.dismiss(toastId);
          throw cause;
        }
      }

      const errorMsg = error instanceof DomainError ? error.message : 'Failed to update case status';
      logger.error('Failed to update case status', { caseId, status, error });
      toast.error(errorMsg, { id: toastId });
      throw error;
    }
  }

  /**
   * Delete a case with UI feedback
   */
  async deleteCaseWithFeedback(caseId: string, personName?: string): Promise<void> {
    try {
      await this.deleteCase.execute({ caseId });

      const name = personName || 'Case';
      toast.success(`${name} deleted successfully`);

      logger.info('Case deleted successfully', { caseId });
    } catch (error) {
      const errorMsg = error instanceof DomainError ? error.message : 'Failed to delete case';
      logger.error('Failed to delete case', { caseId, error });
      toast.error(errorMsg);
      throw error;
    }
  }

  /**
   * Get a single case by ID
   */
  getCase(caseId: string): Case | null {
    return this.appState.getCase(caseId);
  }

  /**
   * Get all cases from ApplicationState (no async operation)
   */
  getCases(): Case[] {
    return this.appState.getCases();
  }
}

export default CaseManagementService;
