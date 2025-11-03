import AutosaveFileService from '@/utils/AutosaveFileService';
import { Case, type CaseSnapshot } from '@/domain/cases/entities/Case';
import type { FinancialItem } from '@/domain/financials/entities/FinancialItem';
import type { Note, NoteCategory } from '@/domain/notes/entities/Note';
import type { Alert } from '@/domain/alerts/entities/Alert';
import type { ActivityEvent } from '@/domain/activity/entities/ActivityEvent';
import type { FeatureFlags } from '@/utils/featureFlags';
import { createLogger } from '@/utils/logger';
import {
  createLegacyMetadata,
  personSnapshotFromLegacy,
} from '@/application/services/caseLegacyMapper';
import type {
  ICaseRepository,
  IFinancialRepository,
  INoteRepository,
  IAlertRepository,
  IActivityRepository,
} from '@/domain/common/repositories';

const logger = createLogger('StorageRepository');

export type DomainScope = 'cases' | 'financials' | 'notes' | 'alerts' | 'activities';

type StorageCollections = {
  cases: CaseSnapshot[];
  financials: FinancialItem[];
  notes: Note[];
  alerts: Alert[];
  activities: ActivityEvent[];
};

type StorageFile = StorageCollections & {
  version: number;
  featureFlags?: Partial<FeatureFlags>;
  [key: string]: unknown;
};

type DomainEntity = Case | CaseSnapshot | FinancialItem | Note | Alert | ActivityEvent;

export class StorageRepository {
  private static readonly CURRENT_VERSION = 1;

  private readonly caseAdapter: ICaseRepository;
  private readonly financialAdapter: IFinancialRepository;
  private readonly noteAdapter: INoteRepository;
  private readonly alertAdapter: IAlertRepository;
  private readonly activityAdapter: IActivityRepository;

  constructor(private readonly fileService: AutosaveFileService) {
    this.caseAdapter = {
      getById: id => this.getById('cases', id),
      getAll: () => this.getAll('cases'),
      save: entity => this.save('cases', entity),
      delete: id => this.delete('cases', id),
      findByMCN: mcn => this.findByMCN('cases', mcn),
      searchCases: query => this.searchCases('cases', query),
    };

    this.financialAdapter = {
      getById: id => this.getById('financials', id),
      getAll: () => this.getAll('financials'),
      save: entity => this.save('financials', entity),
      delete: id => this.delete('financials', id),
      getByCaseId: caseId => this.getByCaseId('financials', caseId),
      getByCategory: category => this.getByCategory('financials', category),
    };

    this.noteAdapter = {
      getById: id => this.getById('notes', id),
      getAll: () => this.getAll('notes'),
      save: entity => this.save('notes', entity),
      delete: id => this.delete('notes', id),
      getByCaseId: caseId => this.getByCaseId('notes', caseId),
      filterByCategory: (caseId, category) => this.filterByCategory('notes', caseId, category),
    };

    this.alertAdapter = {
      getById: id => this.getById('alerts', id),
      getAll: () => this.getAll('alerts'),
      save: entity => this.save('alerts', entity),
      delete: id => this.delete('alerts', id),
      findByMCN: mcn => this.findByMCN('alerts', mcn),
      getUnmatched: () => this.getUnmatched('alerts'),
    };

    this.activityAdapter = {
      getById: id => this.getById('activities', id),
      getAll: () => this.getAll('activities'),
      save: entity => this.save('activities', entity),
      delete: id => this.delete('activities', id),
      getByAggregateId: aggregateId => this.getByAggregateId('activities', aggregateId),
      getRecent: limit => this.getRecent('activities', limit),
    };
  }

  get cases(): ICaseRepository {
    return this.caseAdapter;
  }

  get financials(): IFinancialRepository {
    return this.financialAdapter;
  }

  get notes(): INoteRepository {
    return this.noteAdapter;
  }

  get alerts(): IAlertRepository {
    return this.alertAdapter;
  }

  get activity(): IActivityRepository {
    return this.activityAdapter;
  }

  async getById(domain: DomainScope, id: string): Promise<any> {
    const storage = await this.readStorage();

    switch (domain) {
      case 'cases':
        return this.cloneCaseEntity(storage.cases.find(item => item.id === id) ?? null);
      case 'financials':
        return this.clone(storage.financials.find(item => item.id === id) ?? null);
      case 'notes':
        return this.clone(storage.notes.find(item => item.id === id) ?? null);
      case 'alerts':
        return this.clone(storage.alerts.find(item => item.id === id) ?? null);
      case 'activities':
        return this.clone(storage.activities.find(item => item.id === id) ?? null);
      default:
        return this.cloneCaseEntity(storage.cases.find(item => item.id === id) ?? null);
    }
  }

  async getAll(domain: DomainScope): Promise<any[]> {
    const storage = await this.readStorage();

    switch (domain) {
      case 'cases':
        return this.cloneCaseEntities(storage.cases);
      case 'financials':
        return this.clone(storage.financials);
      case 'notes':
        return this.clone(storage.notes);
      case 'alerts':
        return this.clone(storage.alerts);
      case 'activities':
        return this.clone(storage.activities);
      default:
        return this.cloneCaseEntities(storage.cases);
    }
  }

  async save(domain: DomainScope, entity: DomainEntity): Promise<void> {
    const storage = await this.readStorage();

    if (domain === 'cases') {
      const snapshot = this.toCaseSnapshot(entity as Case | CaseSnapshot);
      storage.cases = StorageRepository.upsert<CaseSnapshot>(storage.cases, snapshot);
    } else if (domain === 'financials') {
      const cloned = this.clone(entity) as FinancialItem;
      storage.financials = StorageRepository.upsert<FinancialItem>(storage.financials, cloned);
    } else if (domain === 'notes') {
      const cloned = this.clone(entity) as Note;
      storage.notes = StorageRepository.upsert<Note>(storage.notes, cloned);
    } else if (domain === 'alerts') {
      const cloned = this.clone(entity) as Alert;
      storage.alerts = StorageRepository.upsert<Alert>(storage.alerts, cloned);
    } else if (domain === 'activities') {
      const cloned = this.clone(entity) as ActivityEvent;
      storage.activities = StorageRepository.upsert<ActivityEvent>(storage.activities, cloned);
    } else {
      throw new Error('StorageRepository.save: Unsupported entity type');
    }

    await this.writeStorage(storage);
  }

  async delete(domain: DomainScope, id: string): Promise<void> {
    const storage = await this.readStorage();

    switch (domain) {
      case 'financials':
        storage.financials = storage.financials.filter(item => item.id !== id);
        break;
      case 'notes':
        storage.notes = storage.notes.filter(item => item.id !== id);
        break;
      case 'alerts':
        storage.alerts = storage.alerts.filter(item => item.id !== id);
        break;
      case 'activities':
        storage.activities = storage.activities.filter(item => item.id !== id);
        break;
      case 'cases':
      default:
        storage.cases = storage.cases.filter(item => item.id !== id);
        break;
    }

    await this.writeStorage(storage);
  }

  async findByMCN(domain: DomainScope, mcn: string): Promise<any> {
    if (domain === 'alerts') {
      const storage = await this.readStorage();
      return this.clone(storage.alerts.filter(alert => this.normalize(alert.mcn) === this.normalize(mcn)));
    }

    if (domain === 'cases') {
      const storage = await this.readStorage();
      const match = storage.cases.find(caseItem => this.normalize(caseItem.mcn) === this.normalize(mcn)) ?? null;
      return this.cloneCaseEntity(match);
    }

    throw new Error('StorageRepository.findByMCN is only supported for cases or alerts');
  }

  async searchCases(domain: DomainScope, query: string): Promise<Case[]> {
    if (domain !== 'cases') {
      throw new Error('StorageRepository.searchCases can only be used for the cases domain');
    }

    const storage = await this.readStorage();
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return this.cloneCaseEntities(storage.cases);
    }

    const filtered = storage.cases.filter(caseItem => {
      const name = `${caseItem.name ?? ''}`.toLowerCase();
      const mcn = this.normalize(caseItem.mcn);
      return name.includes(normalizedQuery) || mcn.includes(normalizedQuery);
    });

    return this.cloneCaseEntities(filtered);
  }

  async getByCaseId(domain: DomainScope, caseId: string): Promise<any[]> {
    const storage = await this.readStorage();

    if (domain === 'financials') {
      return this.clone(storage.financials.filter(item => item.caseId === caseId));
    }

    if (domain === 'notes') {
      return this.clone(storage.notes.filter(item => item.caseId === caseId));
    }

    throw new Error('StorageRepository.getByCaseId is only supported for financials or notes');
  }

  async filterByCategory(domain: DomainScope, caseId: string, category: NoteCategory): Promise<Note[]> {
    if (domain !== 'notes') {
      throw new Error('StorageRepository.filterByCategory can only be used for the notes domain');
    }

    const storage = await this.readStorage();
    return this.clone(
      storage.notes.filter(note => note.caseId === caseId && note.category === category),
    );
  }

  async getByCategory(domain: DomainScope, category: string): Promise<FinancialItem[]> {
    if (domain !== 'financials') {
      throw new Error('StorageRepository.getByCategory can only be used for the financials domain');
    }

    const storage = await this.readStorage();
    return this.clone(storage.financials.filter(item => item.category === category));
  }

  async getUnmatched(domain: DomainScope): Promise<Alert[]> {
    if (domain !== 'alerts') {
      throw new Error('StorageRepository.getUnmatched can only be used for the alerts domain');
    }

    const storage = await this.readStorage();
    return this.clone(storage.alerts.filter(alert => !alert.caseId));
  }

  async getByAggregateId(domain: DomainScope, aggregateId: string): Promise<ActivityEvent[]> {
    if (domain !== 'activities') {
      throw new Error('StorageRepository.getByAggregateId can only be used for the activity domain');
    }

    const storage = await this.readStorage();
    return this.clone(storage.activities.filter(event => event.aggregateId === aggregateId));
  }

  async getRecent(domain: DomainScope, limit: number): Promise<ActivityEvent[]> {
    if (domain !== 'activities') {
      throw new Error('StorageRepository.getRecent can only be used for the activity domain');
    }

    const storage = await this.readStorage();
    const sorted = [...storage.activities].sort(
      (a, b) => this.toTimestamp(b.timestamp) - this.toTimestamp(a.timestamp),
    );

    return this.clone(sorted.slice(0, Math.max(0, limit)));
  }

  private async readStorage(): Promise<StorageFile> {
    const raw = await this.fileService.readFile();
    const base = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

    const version = typeof base.version === 'number' ? base.version : StorageRepository.CURRENT_VERSION;
    const rawCases = this.ensureArray<any>(base.cases);
    
    // Validate case shape helper
    const isValidCaseItem = (item: any): boolean => {
      return item && typeof item === 'object' && typeof item.id === 'string';
    };

    let invalidReadCount = 0;
    let invalidRehydrationCount = 0;
    const MAX_LOG_SAMPLE = 3;
    const invalidReadSamples: unknown[] = [];
    const invalidRehydrationSamples: Array<{ id: string; error: string }> = [];
    
    // Convert CaseDisplay format to CaseSnapshot if needed (for legacy DataManager compatibility)
    const caseSnapshots: CaseSnapshot[] = rawCases
      .map((item: any) => {
        if (!isValidCaseItem(item)) {
          invalidReadCount++;
          if (invalidReadSamples.length < MAX_LOG_SAMPLE) {
            invalidReadSamples.push(item);
          }
          return null;
        }

        try {
          // Detect CaseDisplay format (has 'person' and 'caseRecord' objects)
          if (item.person && item.caseRecord) {
            const legacyDisplay = {
              id: item.id,
              name: item.name,
              mcn: item.mcn,
              status: item.status,
              priority: Boolean(item.priority),
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
              person: item.person,
              caseRecord: item.caseRecord,
              alerts: Array.isArray(item.alerts) ? item.alerts : [],
            };

            return {
              id: legacyDisplay.id,
              mcn: legacyDisplay.mcn,
              name: legacyDisplay.name,
              status: legacyDisplay.status,
              personId: legacyDisplay.person.id,
              createdAt: legacyDisplay.createdAt,
              updatedAt: legacyDisplay.updatedAt,
              metadata: createLegacyMetadata(legacyDisplay, item.metadata),
              person: personSnapshotFromLegacy(legacyDisplay.person),
            } as CaseSnapshot;
          }
          // Already CaseSnapshot format
          return item as CaseSnapshot;
        } catch (error) {
          // Skip invalid items during conversion
          invalidReadCount++;
          if (invalidReadSamples.length < MAX_LOG_SAMPLE) {
            invalidReadSamples.push({ itemId: item?.id, error: error instanceof Error ? error.message : String(error) });
          }
          return null;
        }
      })
      .filter((snapshot): snapshot is CaseSnapshot => snapshot !== null);
    
    if (invalidReadCount > 0) {
      logger.warn(
        `[StorageRepository] Skipped ${invalidReadCount} invalid case(s) during read — sample(s):`,
        invalidReadSamples[0] as Record<string, unknown>
      );
    }

    // Rehydrate and validate cases, filtering out any that fail validation
    const cases = caseSnapshots
      .map(snapshot => {
        try {
          return Case.rehydrate(snapshot).toJSON();
        } catch (error) {
          // Skip cases that fail validation
          invalidRehydrationCount++;
          if (invalidRehydrationSamples.length < MAX_LOG_SAMPLE) {
            invalidRehydrationSamples.push({
              id: snapshot.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return null;
        }
      })
      .filter((caseSnapshot): caseSnapshot is CaseSnapshot => caseSnapshot !== null);

    if (invalidRehydrationCount > 0) {
      logger.warn(
        `[StorageRepository] Skipped ${invalidRehydrationCount} invalid case(s) during rehydration — sample(s):`,
        invalidRehydrationSamples[0] as Record<string, unknown>
      );
    }
    
    const financials = this.ensureArray<FinancialItem>(base.financials);
    const notes = this.ensureArray<Note>(base.notes);
    const alerts = this.ensureArray<Alert>(base.alerts);
    const activities = this.ensureArray<ActivityEvent>(base.activities);

    const extras: Record<string, unknown> = { ...base };
    delete extras.version;
    delete extras.cases;
    delete extras.financials;
    delete extras.notes;
    delete extras.alerts;
    delete extras.activities;

    return {
      version,
      cases,
      financials,
      notes,
      alerts,
      activities,
      ...extras,
    } as StorageFile;
  }

  private async writeStorage(storage: StorageFile): Promise<void> {
    const payload = this.clone({
      ...storage,
      version: StorageRepository.CURRENT_VERSION,
    });

    const success = await this.fileService.writeFile(payload);
    if (!success) {
      throw new Error('StorageRepository: Failed to persist data');
    }
  }

  private cloneCaseEntity(snapshot: CaseSnapshot | null): Case | null {
    if (!snapshot) {
      return null;
    }

    return Case.rehydrate(this.cloneCaseSnapshot(snapshot));
  }

  private cloneCaseEntities(snapshots: CaseSnapshot[]): Case[] {
    return snapshots.map(snapshot => Case.rehydrate(this.cloneCaseSnapshot(snapshot)));
  }

  private cloneCaseSnapshot(snapshot: CaseSnapshot): CaseSnapshot {
    return JSON.parse(JSON.stringify(snapshot)) as CaseSnapshot;
  }

  private toCaseSnapshot(entity: Case | CaseSnapshot): CaseSnapshot {
    if (entity instanceof Case) {
      return entity.toJSON();
    }

    return Case.rehydrate(entity).toJSON();
  }

  private ensureArray<T>(value: unknown): T[] {
    if (Array.isArray(value)) {
      return this.clone(value as T[]);
    }

    return [];
  }

  private clone<T>(value: T): T {
    return value === null || value === undefined
      ? (value as T)
      : (JSON.parse(JSON.stringify(value)) as T);
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  private toTimestamp(value: string): number {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private static upsert<T extends { id: string }>(collection: T[], entity: T): T[] {
    const existingIndex = collection.findIndex(item => item.id === entity.id);

    if (existingIndex >= 0) {
      const updated = [...collection];
      updated[existingIndex] = entity;
      return updated;
    }

    return [...collection, entity];
  }

  /**
   * Retrieve feature flags from storage.
   */
  async getFeatureFlags(): Promise<Partial<FeatureFlags>> {
    const storage = await this.readStorage();
    // Check both the storage file and extras for feature flags
    const extras = storage as StorageFile & { featureFlags?: Partial<FeatureFlags> };
    return extras.featureFlags ?? {};
  }

  /**
   * Save feature flags to storage.
   */
  async saveFeatureFlags(flags: Partial<FeatureFlags>): Promise<void> {
    const storage = await this.readStorage();
    const updated = { ...storage, featureFlags: flags };
    await this.writeStorage(updated);
  }
}

export default StorageRepository;
