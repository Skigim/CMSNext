import { toast } from 'sonner';
import type { CaseDisplay, NewCaseRecordData, NewNoteData, NewPersonData } from '@/types/case';
import { CaseManagementAdapter } from './CaseManagementAdapter';
import { CaseManagementService } from './CaseManagementService';
import { caseToLegacyCaseDisplay } from './caseLegacyMapper';
import { createLogger } from '@/utils/logger';
import { getFileStorageFlags, updateFileStorageFlags } from '@/utils/fileStorageFlags';
import type { CaseStatus } from '@/types/case';
import type ApplicationState from '@/application/ApplicationState';
import type { StorageRepository } from '@/infrastructure/storage/StorageRepository';

const logger = createLogger('CaseServiceFactory');

export interface CaseServiceContract {
  isAvailable(): boolean;
  loadCases(): Promise<CaseDisplay[]>;
  saveCase(
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: CaseDisplay | null,
  ): Promise<CaseDisplay>;
  deleteCase(caseId: string, personName?: string): Promise<void>;
  saveNote(
    noteData: NewNoteData,
    caseId: string,
    editingNote?: { id: string } | null,
  ): Promise<CaseDisplay>;
  importCases(importedCases: CaseDisplay[]): Promise<void>;
  updateCaseStatus(caseId: string, status: CaseStatus): Promise<CaseDisplay>;
}

class LegacyCaseService implements CaseServiceContract {
  constructor(private readonly legacy: CaseManagementAdapter) {}

  isAvailable(): boolean {
    return this.legacy.isAvailable();
  }

  loadCases(): Promise<CaseDisplay[]> {
    return this.legacy.loadCases();
  }

  saveCase(
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: CaseDisplay | null,
  ): Promise<CaseDisplay> {
    return this.legacy.saveCase(caseData, editingCase);
  }

  deleteCase(caseId: string, personName?: string): Promise<void> {
    return this.legacy.deleteCase(caseId, personName);
  }

  saveNote(
    noteData: NewNoteData,
    caseId: string,
    editingNote?: { id: string } | null,
  ): Promise<CaseDisplay> {
    return this.legacy.saveNote(noteData, caseId, editingNote);
  }

  importCases(importedCases: CaseDisplay[]): Promise<void> {
    return this.legacy.importCases(importedCases);
  }

  updateCaseStatus(caseId: string, status: CaseStatus): Promise<CaseDisplay> {
    return this.legacy.updateCaseStatus(caseId, status);
  }
}

class HybridCaseService implements CaseServiceContract {
  constructor(
    private readonly domain: CaseManagementService,
    private readonly legacy: CaseManagementAdapter,
    private readonly appState: ApplicationState,
    private readonly storage: StorageRepository,
  ) {}

  isAvailable(): boolean {
    // While the domain service drives reads, we still rely on the legacy adapter
    // for note CRUD until those use cases are migrated.
    return this.legacy.isAvailable();
  }

  async loadCases(): Promise<CaseDisplay[]> {
    try {
      const cases = await this.domain.loadCases();

      // Ensure ApplicationState stays in sync with on-disk storage so downstream
      // use cases (update/delete) can rely on the in-memory cache.
      try {
        await this.appState.hydrate(this.storage);
      } catch (error) {
        logger.warn('Application state hydration failed after load', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const displays = cases.map(caseToLegacyCaseDisplay);
      updateFileStorageFlags({ dataBaseline: true, sessionHadData: displays.length > 0 });

      if (displays.length === 0 && !getFileStorageFlags().inConnectionFlow) {
        toast.success('Connected successfully - ready to start fresh', {
          id: 'connected-empty',
          duration: 3000,
        });
      }

      return displays;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const toastMessage = `Failed to load cases: ${message}. Please check your connection and try again.`;
      toast.error(toastMessage);
      throw error;
    }
  }

  saveCase(
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: CaseDisplay | null,
  ): Promise<CaseDisplay> {
    // Case creation & updates still pass through the legacy adapter until the
    // domain service supports form-to-domain mapping.
    return this.legacy.saveCase(caseData, editingCase);
  }

  async deleteCase(caseId: string, personName?: string): Promise<void> {
    await this.domain.deleteCaseWithFeedback(caseId, personName);
  }

  saveNote(
    noteData: NewNoteData,
    caseId: string,
    editingNote?: { id: string } | null,
  ): Promise<CaseDisplay> {
    return this.legacy.saveNote(noteData, caseId, editingNote);
  }

  importCases(importedCases: CaseDisplay[]): Promise<void> {
    return this.legacy.importCases(importedCases);
  }

  async updateCaseStatus(caseId: string, status: CaseStatus): Promise<CaseDisplay> {
    const updated = await this.domain.updateCaseStatus(caseId, status);
    return caseToLegacyCaseDisplay(updated);
  }
}

export interface DomainServiceDependencies {
  service: CaseManagementService;
  appState: ApplicationState;
  storage: StorageRepository;
}

interface CaseServiceFactoryOptions {
  legacy: CaseManagementAdapter;
  domain?: DomainServiceDependencies | null;
  useDomain: boolean;
}

export function createCaseService({ legacy, domain, useDomain }: CaseServiceFactoryOptions): CaseServiceContract {
  if (useDomain && domain) {
    return new HybridCaseService(domain.service, legacy, domain.appState, domain.storage);
  }

  return new LegacyCaseService(legacy);
}
