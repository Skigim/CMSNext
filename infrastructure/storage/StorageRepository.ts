import { FileStorageService, type FileData, type NormalizedFileData, isNormalizedFileData } from '@/utils/services/FileStorageService';
import { Case, type CaseSnapshot } from '@/domain/cases/entities/Case';
import { FinancialItem } from '@/domain/financials/entities/FinancialItem';
import type { Note, NoteCategory } from '@/domain/notes/entities/Note';
import type { Alert } from '@/domain/alerts/entities/Alert';
import type { ActivityEvent } from '@/domain/activity/entities/ActivityEvent';
import type { FeatureFlags } from '@/utils/featureFlags';
import type {
  ICaseRepository,
  IFinancialRepository,
  INoteRepository,
  IAlertRepository,
  IActivityRepository,
} from '@/domain/common/repositories';
import type { ITransactionRepository, TransactionOperation } from '@/domain/common/repositories/ITransactionRepository';

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

export class StorageRepository implements ITransactionRepository {
  private static readonly CURRENT_VERSION = 1;

  private readonly caseAdapter: ICaseRepository;
  private readonly financialAdapter: IFinancialRepository;
  private readonly noteAdapter: INoteRepository;
  private readonly alertAdapter: IAlertRepository;
  private readonly activityAdapter: IActivityRepository;

  constructor(private readonly fileStorageService: FileStorageService) {
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

  async runTransaction(operations: TransactionOperation[]): Promise<void> {
    const storage = await this.readStorage();

    for (const op of operations) {
      if (op.type === 'save') {
        if (op.domain === 'cases') {
          const snapshot = this.toCaseSnapshot(op.entity);
          storage.cases = StorageRepository.upsert<CaseSnapshot>(storage.cases, snapshot);
        } else if (op.domain === 'financials') {
          const cloned = this.clone(op.entity) as FinancialItem;
          storage.financials = StorageRepository.upsert<FinancialItem>(storage.financials, cloned);
        } else if (op.domain === 'notes') {
          const cloned = this.clone(op.entity) as Note;
          storage.notes = StorageRepository.upsert<Note>(storage.notes, cloned);
        } else if (op.domain === 'alerts') {
          const cloned = this.clone(op.entity) as Alert;
          storage.alerts = StorageRepository.upsert<Alert>(storage.alerts, cloned);
        } else if (op.domain === 'activities') {
          const cloned = this.clone(op.entity) as ActivityEvent;
          storage.activities = StorageRepository.upsert<ActivityEvent>(storage.activities, cloned);
        }
      } else if (op.type === 'delete') {
        switch (op.domain) {
          case 'financials':
            storage.financials = storage.financials.filter(item => item.id !== op.id);
            break;
          case 'notes':
            storage.notes = storage.notes.filter(item => item.id !== op.id);
            break;
          case 'alerts':
            storage.alerts = storage.alerts.filter(item => item.id !== op.id);
            break;
          case 'activities':
            storage.activities = storage.activities.filter(item => item.id !== op.id);
            break;
          case 'cases':
            storage.cases = storage.cases.filter(item => item.id !== op.id);
            break;
        }
      }
    }

    await this.writeStorage(storage);
  }

  private async readStorage(): Promise<StorageFile> {
    const raw = await this.fileStorageService.readFileData();
    
    if (!raw) {
      return {
        version: StorageRepository.CURRENT_VERSION,
        cases: [],
        financials: [],
        notes: [],
        alerts: [],
        activities: [],
      } as StorageFile;
    }

    // FileStorageService returns LegacyFileData (denormalized)
    // We need to extract the entities back into flat lists for the repository
    
    // 1. Cases (strip nested data)
    const cases = raw.cases.map(c => {
      const { financials: _, notes: __, ...caseRecord } = c.caseRecord;
      const { alerts: ___, ...caseData } = c;

      // Preserve legacy caseRecord data in metadata
      const metadata = {
        ...(c.metadata || {}),
        legacy_caseRecord: caseRecord,
      };

      return {
        ...caseData,
        personId: c.caseRecord.personId || c.person?.id,
        metadata,
      } as CaseSnapshot;
    });

    // 2. Financials (flatten from cases)
    const financials: FinancialItem[] = [];
    raw.cases.forEach(c => {
      if (c.caseRecord.financials) {
        const { resources = [], income = [], expenses = [] } = c.caseRecord.financials;
        
        const processItems = (items: any[], category: string) => {
          items.forEach(item => {
            try {
              financials.push(FinancialItem.rehydrate({ ...item, caseId: c.id, category }));
            } catch (error) {
              console.warn(`Skipping corrupt financial item ${item.id} in case ${c.id}:`, error);
            }
          });
        };

        processItems(resources, 'resources');
        processItems(income, 'income');
        processItems(expenses, 'expenses');
      }
    });

    // 3. Notes (flatten from cases)
    const notes: Note[] = [];
    raw.cases.forEach(c => {
      if (c.caseRecord.notes) {
        c.caseRecord.notes.forEach(note => {
          notes.push({ ...note, caseId: c.id } as Note);
        });
      }
    });

    // 4. Alerts (use top-level or flatten)
    const alerts: Alert[] = raw.alerts ? (raw.alerts as Alert[]) : [];
    if (!raw.alerts) {
      raw.cases.forEach(c => {
        if (c.alerts) {
          c.alerts.forEach(alert => alerts.push(alert as Alert));
        }
      });
    }

    // 5. Activities
    const activities = (raw.activityLog || []) as ActivityEvent[];

    return {
      version: StorageRepository.CURRENT_VERSION,
      cases,
      financials,
      notes,
      alerts,
      activities,
      // Preserve other metadata
      exported_at: raw.exported_at,
      total_cases: raw.total_cases,
      categoryConfig: raw.categoryConfig,
    } as StorageFile;
  }

  private async writeStorage(storage: StorageFile): Promise<void> {
    // Reconstruct LegacyFileData structure for FileStorageService
    // FileStorageService.writeFileData expects LegacyFileData and handles normalization internally
    
    // Group financials by case
    const financialsByCase = new Map<string, { resources: any[], income: any[], expenses: any[] }>();
    storage.financials.forEach(f => {
      if (!financialsByCase.has(f.caseId)) {
        financialsByCase.set(f.caseId, { resources: [], income: [], expenses: [] });
      }
      const group = financialsByCase.get(f.caseId)!;
      // Map category string to object key
      const cat = f.category as 'resources' | 'income' | 'expenses';
      if (cat && group[cat]) {
        // Ensure we store plain objects, not class instances
        const itemData = f instanceof FinancialItem ? f.toJSON() : f;
        group[cat].push(itemData);
      } else {
        console.warn(`Invalid financial category "${f.category}" for item ${f.id}, skipping`);
      }
    });

    // Group notes by case
    const notesByCase = new Map<string, any[]>();
    storage.notes.forEach(n => {
      if (!notesByCase.has(n.caseId)) {
        notesByCase.set(n.caseId, []);
      }
      notesByCase.get(n.caseId)!.push(n);
    });

    // Group alerts by MCN (for legacy support)
    const alertsByMcn = new Map<string, any[]>();
    storage.alerts.forEach(a => {
      if (a.mcNumber) {
        if (!alertsByMcn.has(a.mcNumber)) {
          alertsByMcn.set(a.mcNumber, []);
        }
        alertsByMcn.get(a.mcNumber)!.push(a);
      }
    });

    // Rebuild cases with nested data
    const cases = storage.cases.map(c => {
      const financials = financialsByCase.get(c.id) || { resources: [], income: [], expenses: [] };
      const notes = notesByCase.get(c.id) || [];
      const alerts = alertsByMcn.get(c.mcn) || [];

      const legacyRecord = (c.metadata as any)?.legacy_caseRecord || {};

      return {
        ...c,
        alerts, // Legacy support
        caseRecord: {
          ...legacyRecord,
          ...c.caseRecord, // In case it was somehow preserved
          id: c.id,
          mcn: c.mcn,
          status: c.status,
          personId: c.personId,
          financials,
          notes
        }
      } as any; // Cast to any to match CaseDisplay structure roughly
    });

    const fileData: FileData = {
      cases,
      alerts: storage.alerts as any[],
      exported_at: (storage as any).exported_at || new Date().toISOString(),
      total_cases: cases.length,
      categoryConfig: (storage as any).categoryConfig || {},
      activityLog: storage.activities as any[]
    };

    await this.fileStorageService.writeFileData(fileData);
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
