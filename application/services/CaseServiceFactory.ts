import { toast } from 'sonner';
import type { CaseDisplay, NewCaseRecordData, NewNoteData, NewPersonData } from '@/types/case';
import { CaseManagementAdapter } from './CaseManagementAdapter';
import { CaseManagementService } from './CaseManagementService';
import { caseToLegacyCaseDisplay } from './caseLegacyMapper';
import { createLogger } from '@/utils/logger';
import { getFileStorageFlags, updateFileStorageFlags } from '@/utils/fileStorageFlags';
import type { CaseStatus } from '@/types/case';
import ApplicationState from '@/application/ApplicationState';
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
  constructor(
    private readonly legacy: CaseManagementAdapter,
    private readonly appState: ApplicationState,
  ) {}

  isAvailable(): boolean {
    return this.legacy.isAvailable();
  }

  async loadCases(): Promise<CaseDisplay[]> {
    this.appState.setCasesLoading(true);
    this.appState.setCasesError(null);

    try {
      const cases = await this.legacy.loadCases();
      this.appState.setCasesFromLegacyDisplays(cases);
      this.appState.setHasLoadedCases(true);
      return cases;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load cases';
      this.appState.setCasesError(message);
      throw error;
    } finally {
      this.appState.setCasesLoading(false);
    }
  }

  async saveCase(
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: CaseDisplay | null,
  ): Promise<CaseDisplay> {
    this.appState.setCasesError(null);

    try {
      const result = await this.legacy.saveCase(caseData, editingCase);
      this.appState.upsertCaseFromLegacy(result);
      this.appState.setHasLoadedCases(true);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save case';
      this.appState.setCasesError(message);
      throw error;
    }
  }

  async deleteCase(caseId: string, personName?: string): Promise<void> {
    this.appState.setCasesError(null);

    try {
      await this.legacy.deleteCase(caseId, personName);
      this.appState.removeCase(caseId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete case';
      this.appState.setCasesError(message);
      throw error;
    }
  }

  async saveNote(
    noteData: NewNoteData,
    caseId: string,
    editingNote?: { id: string } | null,
  ): Promise<CaseDisplay> {
    this.appState.setCasesError(null);

    try {
      const updated = await this.legacy.saveNote(noteData, caseId, editingNote);
      this.appState.upsertCaseFromLegacy(updated);
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save note';
      this.appState.setCasesError(message);
      throw error;
    }
  }

  async importCases(importedCases: CaseDisplay[]): Promise<void> {
    this.appState.setCasesError(null);

    try {
      await this.legacy.importCases(importedCases);
      importedCases.forEach(display => {
        this.appState.upsertCaseFromLegacy(display);
      });
      this.appState.setHasLoadedCases(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import cases';
      this.appState.setCasesError(message);
      throw error;
    }
  }

  async updateCaseStatus(caseId: string, status: CaseStatus): Promise<CaseDisplay> {
    this.appState.setCasesError(null);

    try {
      const updated = await this.legacy.updateCaseStatus(caseId, status);
      this.appState.upsertCaseFromLegacy(updated);
      return updated;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Failed to update case status';
      this.appState.setCasesError(message);
      throw error;
    }
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
      const displays = await this.domain.loadCases();

      // Ensure ApplicationState stays in sync with on-disk storage so downstream
      // use cases (update/delete) can rely on the in-memory cache.
      try {
        await this.appState.hydrate(this.storage);
      } catch (error) {
        logger.warn('Application state hydration failed after load', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

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

  async saveCase(
    caseData: { person: NewPersonData; caseRecord: NewCaseRecordData },
    editingCase?: CaseDisplay | null,
  ): Promise<CaseDisplay> {
    this.appState.setCasesError(null);

    try {
      // Case creation & updates still pass through the legacy adapter until the
      // domain service supports form-to-domain mapping.
      const result = await this.legacy.saveCase(caseData, editingCase);
      this.appState.upsertCaseFromLegacy(result);
      this.appState.setHasLoadedCases(true);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save case';
      this.appState.setCasesError(message);
      throw error;
    }
  }

  async deleteCase(caseId: string, personName?: string): Promise<void> {
    await this.domain.deleteCaseWithFeedback(caseId, personName);
  }

  async saveNote(
    noteData: NewNoteData,
    caseId: string,
    editingNote?: { id: string } | null,
  ): Promise<CaseDisplay> {
    this.appState.setCasesError(null);

    try {
      const updated = await this.legacy.saveNote(noteData, caseId, editingNote);
      this.appState.upsertCaseFromLegacy(updated);
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save note';
      this.appState.setCasesError(message);
      throw error;
    }
  }

  async importCases(importedCases: CaseDisplay[]): Promise<void> {
    this.appState.setCasesError(null);

    try {
      await this.legacy.importCases(importedCases);
      importedCases.forEach(display => {
        this.appState.upsertCaseFromLegacy(display);
      });
      this.appState.setHasLoadedCases(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import cases';
      this.appState.setCasesError(message);
      throw error;
    }
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

  return new LegacyCaseService(legacy, ApplicationState.getInstance());
}
