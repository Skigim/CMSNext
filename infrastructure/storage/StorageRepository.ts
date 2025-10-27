import AutosaveFileService from '@/utils/AutosaveFileService';
import { Case, type CaseSnapshot } from '@/domain/cases/entities/Case';
import type { FinancialItem } from '@/domain/financials/entities/FinancialItem';
import type { Note, NoteCategory } from '@/domain/notes/entities/Note';
import type { Alert } from '@/domain/alerts/entities/Alert';
import type { ActivityEvent } from '@/domain/activity/entities/ActivityEvent';
import type { FeatureFlags } from '@/utils/featureFlags';
import safeNotifyFileStorageChange from '@/utils/safeNotifyFileStorageChange';
import type {
  ICaseRepository,
  IFinancialRepository,
  INoteRepository,
  IAlertRepository,
  IActivityRepository,
} from '@/domain/common/repositories';

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

export class StorageRepository
  implements
    ICaseRepository,
    IFinancialRepository,
    INoteRepository,
    IAlertRepository,
    IActivityRepository
{
  private static readonly CURRENT_VERSION = 1;

  private domainHint: DomainScope = 'cases';

  private readonly caseAdapter: ICaseRepository;
  private readonly financialAdapter: IFinancialRepository;
  private readonly noteAdapter: INoteRepository;
  private readonly alertAdapter: IAlertRepository;
  private readonly activityAdapter: IActivityRepository;

  constructor(private readonly fileService: AutosaveFileService) {
    this.caseAdapter = {
      getById: id => this.runWithDomain('cases', () => this.getById(id)),
      getAll: () => this.runWithDomain('cases', () => this.getAll()),
      save: entity => this.runWithDomain('cases', () => this.save(entity)),
      delete: id => this.runWithDomain('cases', () => this.delete(id)),
      findByMCN: mcn => this.runWithDomain('cases', () => this.findByMCN(mcn)),
      searchCases: query => this.runWithDomain('cases', () => this.searchCases(query)),
    };

    this.financialAdapter = {
      getById: id => this.runWithDomain('financials', () => this.getById(id)),
      getAll: () => this.runWithDomain('financials', () => this.getAll()),
      save: entity => this.runWithDomain('financials', () => this.save(entity)),
      delete: id => this.runWithDomain('financials', () => this.delete(id)),
      getByCaseId: caseId => this.runWithDomain('financials', () => this.getByCaseId(caseId)),
  getByCategory: category => this.runWithDomain('financials', () => this.getByCategory(category)),
    };

    this.noteAdapter = {
      getById: id => this.runWithDomain('notes', () => this.getById(id)),
      getAll: () => this.runWithDomain('notes', () => this.getAll()),
      save: entity => this.runWithDomain('notes', () => this.save(entity)),
      delete: id => this.runWithDomain('notes', () => this.delete(id)),
      getByCaseId: caseId => this.runWithDomain('notes', () => this.getByCaseId(caseId)),
      filterByCategory: (caseId, category) =>
        this.runWithDomain('notes', () => this.filterByCategory(caseId, category)),
    };

    this.alertAdapter = {
      getById: id => this.runWithDomain('alerts', () => this.getById(id)),
      getAll: () => this.runWithDomain('alerts', () => this.getAll()),
      save: entity => this.runWithDomain('alerts', () => this.save(entity)),
      delete: id => this.runWithDomain('alerts', () => this.delete(id)),
      findByMCN: mcn => this.runWithDomain('alerts', () => this.findByMCN(mcn)),
      getUnmatched: () => this.runWithDomain('alerts', () => this.getUnmatched()),
    };

    this.activityAdapter = {
      getById: id => this.runWithDomain('activities', () => this.getById(id)),
      getAll: () => this.runWithDomain('activities', () => this.getAll()),
      save: entity => this.runWithDomain('activities', () => this.save(entity)),
      delete: id => this.runWithDomain('activities', () => this.delete(id)),
      getByAggregateId: aggregateId =>
        this.runWithDomain('activities', () => this.getByAggregateId(aggregateId)),
      getRecent: limit => this.runWithDomain('activities', () => this.getRecent(limit)),
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

  async getById(id: string): Promise<any> {
    const storage = await this.readStorage();

    switch (this.domainHint) {
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

  async getAll(): Promise<any[]> {
    const storage = await this.readStorage();

    switch (this.domainHint) {
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

  async save(entity: DomainEntity): Promise<void> {
    const storage = await this.readStorage();

    if (this.domainHint === 'cases') {
      const snapshot = this.toCaseSnapshot(entity as Case | CaseSnapshot);
      storage.cases = StorageRepository.upsert<CaseSnapshot>(storage.cases, snapshot);
    } else if (this.domainHint === 'financials') {
      const cloned = this.clone(entity) as FinancialItem;
      storage.financials = StorageRepository.upsert<FinancialItem>(storage.financials, cloned);
    } else if (this.domainHint === 'notes') {
      const cloned = this.clone(entity) as Note;
      storage.notes = StorageRepository.upsert<Note>(storage.notes, cloned);
    } else if (this.domainHint === 'alerts') {
      const cloned = this.clone(entity) as Alert;
      storage.alerts = StorageRepository.upsert<Alert>(storage.alerts, cloned);
    } else if (this.domainHint === 'activities') {
      const cloned = this.clone(entity) as ActivityEvent;
      storage.activities = StorageRepository.upsert<ActivityEvent>(storage.activities, cloned);
    } else {
      throw new Error('StorageRepository.save: Unsupported entity type');
    }

    await this.writeStorage(storage);
  }

  async delete(id: string): Promise<void> {
    const storage = await this.readStorage();

    switch (this.domainHint) {
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

  async findByMCN(mcn: string): Promise<any> {
    if (this.domainHint === 'alerts') {
      const storage = await this.readStorage();
      return this.clone(storage.alerts.filter(alert => this.normalize(alert.mcn) === this.normalize(mcn)));
    }

    if (this.domainHint === 'cases') {
      const storage = await this.readStorage();
      const match = storage.cases.find(caseItem => this.normalize(caseItem.mcn) === this.normalize(mcn)) ?? null;
      return this.cloneCaseEntity(match);
    }

    throw new Error('StorageRepository.findByMCN is only supported for cases or alerts');
  }

  async searchCases(query: string): Promise<Case[]> {
    if (this.domainHint !== 'cases') {
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

  async getByCaseId(caseId: string): Promise<any[]> {
    const storage = await this.readStorage();

    if (this.domainHint === 'financials') {
      return this.clone(storage.financials.filter(item => item.caseId === caseId));
    }

    if (this.domainHint === 'notes') {
      return this.clone(storage.notes.filter(item => item.caseId === caseId));
    }

    throw new Error('StorageRepository.getByCaseId is only supported for financials or notes');
  }

  async filterByCategory(caseId: string, category: NoteCategory): Promise<Note[]> {
    if (this.domainHint !== 'notes') {
      throw new Error('StorageRepository.filterByCategory can only be used for the notes domain');
    }

    const storage = await this.readStorage();
    return this.clone(
      storage.notes.filter(note => note.caseId === caseId && note.category === category),
    );
  }

  async getByCategory(category: string): Promise<FinancialItem[]> {
    if (this.domainHint !== 'financials') {
      throw new Error('StorageRepository.getByCategory can only be used for the financials domain');
    }

    const storage = await this.readStorage();
    return this.clone(storage.financials.filter(item => item.category === category));
  }

  async getUnmatched(): Promise<Alert[]> {
    if (this.domainHint !== 'alerts') {
      throw new Error('StorageRepository.getUnmatched can only be used for the alerts domain');
    }

    const storage = await this.readStorage();
    return this.clone(storage.alerts.filter(alert => !alert.caseId));
  }

  async getByAggregateId(aggregateId: string): Promise<ActivityEvent[]> {
    if (this.domainHint !== 'activities') {
      throw new Error('StorageRepository.getByAggregateId can only be used for the activity domain');
    }

    const storage = await this.readStorage();
    return this.clone(storage.activities.filter(event => event.aggregateId === aggregateId));
  }

  async getRecent(limit: number): Promise<ActivityEvent[]> {
    if (this.domainHint !== 'activities') {
      throw new Error('StorageRepository.getRecent can only be used for the activity domain');
    }

    const storage = await this.readStorage();
    const sorted = [...storage.activities].sort(
      (a, b) => this.toTimestamp(b.timestamp) - this.toTimestamp(a.timestamp),
    );

    return this.clone(sorted.slice(0, Math.max(0, limit)));
  }

  private async runWithDomain<T>(domain: DomainScope, action: () => Promise<T>): Promise<T> {
    const previousDomain = this.domainHint;
    this.domainHint = domain;

    try {
      return await action();
    } finally {
      this.domainHint = previousDomain;
    }
  }

  private async readStorage(): Promise<StorageFile> {
    const raw = await this.fileService.readFile();
    const base = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

    const version = typeof base.version === 'number' ? base.version : StorageRepository.CURRENT_VERSION;
  const rawCases = this.ensureArray<CaseSnapshot>(base.cases);
  const cases = rawCases.map(snapshot => Case.rehydrate(snapshot).toJSON());
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
    
    safeNotifyFileStorageChange();
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
