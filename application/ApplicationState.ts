import { Case, type CaseSnapshot } from '@/domain/cases/entities/Case';
import { FinancialItem } from '@/domain/financials/entities/FinancialItem';
import { Note } from '@/domain/notes/entities/Note';
import { Alert } from '@/domain/alerts/entities/Alert';
import { ActivityEvent } from '@/domain/activity/entities/ActivityEvent';
import type StorageRepository from '@/infrastructure/storage/StorageRepository';
import type { IRepository } from '@/domain/common/repositories';
import {
  createFeatureFlagContext,
  type FeatureFlagKey,
  type FeatureFlags,
} from '@/utils/featureFlags';

type EntityWithId = { id: string };

type Listener = () => void;

export interface ApplicationStateSnapshot {
  cases: Case[];
  financials: FinancialItem[];
  notes: Note[];
  alerts: Alert[];
  activities: ActivityEvent[];
  featureFlags: FeatureFlags;
}

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) {
    return value as T;
  }

  if (value instanceof Case) {
    return value.clone() as T;
  }

  if (value instanceof FinancialItem) {
    return value.clone() as T;
  }

  if (value instanceof Note) {
    return value.clone() as T;
  }

  if (value instanceof Alert) {
    return value.clone() as T;
  }

  if (value instanceof ActivityEvent) {
    return value.clone() as T;
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export class ApplicationState {
  private static instance: ApplicationState | null = null;

  private readonly cases = new Map<string, Case>();
  private readonly financials = new Map<string, FinancialItem>();
  private readonly notes = new Map<string, Note>();
  private readonly alerts = new Map<string, Alert>();
  private readonly activities = new Map<string, ActivityEvent>();
  private featureFlags: FeatureFlags = createFeatureFlagContext();

  private readonly listeners = new Set<Listener>();
  private version = 0;

  private constructor() {}

  static getInstance(): ApplicationState {
    if (!ApplicationState.instance) {
      ApplicationState.instance = new ApplicationState();
    }

    return ApplicationState.instance;
  }

  static resetInstance(): void {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    ApplicationState.instance = null;
  }

  static resetForTesting(): void {
    ApplicationState.resetInstance();
  }

  getVersion(): number {
    return this.version;
  }

  getSnapshot(): ApplicationStateSnapshot {
    return {
      cases: this.getCases(),
      financials: this.getFinancialItems(),
      notes: this.getNotes(),
      alerts: this.getAlerts(),
      activities: this.getActivities(),
      featureFlags: this.getFeatureFlags(),
    };
  }

  async hydrate(storage: StorageRepository | null | undefined): Promise<void> {
    if (!storage) {
      throw new Error('ApplicationState.hydrate requires a StorageRepository instance');
    }

    const [cases, financials, notes, alerts, activities, featureFlags] = await Promise.all([
      storage.cases.getAll(),
      storage.financials.getAll(),
      storage.notes.getAll(),
      storage.alerts.getAll(),
      storage.activity.getAll(),
      storage.getFeatureFlags(),
    ]);

  this.replaceCases(cases);
    this.replaceCollection(this.financials, financials);
    this.replaceCollection(this.notes, notes);
    this.replaceCollection(this.alerts, alerts);
    this.replaceCollection(this.activities, activities);

    // Restore feature flags if available
    if (featureFlags && Object.keys(featureFlags).length > 0) {
      this.setFeatureFlags(featureFlags);
    }

    this.notifyListeners();
  }

  getFeatureFlags(): FeatureFlags {
    return { ...this.featureFlags };
  }

  isFeatureEnabled(flag: FeatureFlagKey): boolean {
    return Boolean(this.featureFlags[flag]);
  }

  setFeatureFlags(flags: Partial<FeatureFlags>): void {
    if (!flags || Object.keys(flags).length === 0) {
      return;
    }

    const nextFlags = createFeatureFlagContext({
      ...this.featureFlags,
      ...flags,
    });

    const changed = (Object.keys(flags) as FeatureFlagKey[]).some(key => this.featureFlags[key] !== nextFlags[key]);

    if (!changed) {
      return;
    }

    this.featureFlags = nextFlags;
    this.notifyListeners();
  }

  async persist(storage: StorageRepository | null | undefined): Promise<void> {
    if (!storage) {
      throw new Error('ApplicationState.persist requires a StorageRepository instance');
    }

    await Promise.all([
      this.syncRepository(storage.cases, this.cases),
      this.syncRepository(storage.financials, this.financials),
      this.syncRepository(storage.notes, this.notes),
      this.syncRepository(storage.alerts, this.alerts),
      this.syncRepository(storage.activity, this.activities),
      storage.saveFeatureFlags(this.featureFlags),
    ]);
  }

  getCases(): Case[] {
    return Array.from(this.cases.values()).map(entity => entity.clone());
  }

  getCase(id: string): Case | null {
    const entity = this.cases.get(id);
    return entity ? entity.clone() : null;
  }

  addCase(caseEntity: Case): void {
    this.cases.set(caseEntity.id, caseEntity.clone());
    this.notifyListeners();
  }

  updateCase(id: string, updates: Partial<CaseSnapshot>): void {
    const existing = this.cases.get(id);
    if (!existing) {
      return;
    }

    const mergedSnapshot: CaseSnapshot = {
      ...existing.toJSON(),
      ...cloneValue(updates),
      updatedAt: updates.updatedAt ?? new Date().toISOString(),
    };

    const updated = Case.rehydrate(mergedSnapshot);
    this.cases.set(id, updated);
    this.notifyListeners();
  }

  removeCase(id: string): void {
    if (this.cases.delete(id)) {
      this.notifyListeners();
    }
  }

  getFinancialItems(): FinancialItem[] {
    return this.toArray(this.financials);
  }

  getFinancialItem(id: string): FinancialItem | null {
    const entity = this.financials.get(id);
    return entity ? cloneValue(entity) : null;
  }

  upsertFinancialItem(item: FinancialItem): void {
    this.financials.set(item.id, cloneValue(item));
    this.notifyListeners();
  }

  removeFinancialItem(id: string): void {
    if (this.financials.delete(id)) {
      this.notifyListeners();
    }
  }

  getNotes(): Note[] {
    return this.toArray(this.notes);
  }

  getNote(id: string): Note | null {
    const entity = this.notes.get(id);
    return entity ? cloneValue(entity) : null;
  }

  upsertNote(note: Note): void {
    this.notes.set(note.id, cloneValue(note));
    this.notifyListeners();
  }

  removeNote(id: string): void {
    if (this.notes.delete(id)) {
      this.notifyListeners();
    }
  }

  getAlerts(): Alert[] {
    return this.toArray(this.alerts);
  }

  getAlert(id: string): Alert | null {
    const entity = this.alerts.get(id);
    return entity ? cloneValue(entity) : null;
  }

  upsertAlert(alert: Alert): void {
    this.alerts.set(alert.id, cloneValue(alert));
    this.notifyListeners();
  }

  removeAlert(id: string): void {
    if (this.alerts.delete(id)) {
      this.notifyListeners();
    }
  }

  getActivities(): ActivityEvent[] {
    return this.toArray(this.activities);
  }

  getActivity(id: string): ActivityEvent | null {
    const entity = this.activities.get(id);
    return entity ? cloneValue(entity) : null;
  }

  upsertActivity(event: ActivityEvent): void {
    this.activities.set(event.id, cloneValue(event));
    this.notifyListeners();
  }

  removeActivity(id: string): void {
    if (this.activities.delete(id)) {
      this.notifyListeners();
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private replaceCollection<T extends EntityWithId>(map: Map<string, T>, items: T[]): void {
    map.clear();
    items.forEach(item => {
      map.set(item.id, cloneValue(item));
    });
  }

  private replaceCases(items: Case[]): void {
    this.cases.clear();
    items.forEach(item => {
      this.cases.set(item.id, item.clone());
    });
  }

  private toArray<T extends EntityWithId>(map: Map<string, T>): T[] {
    return Array.from(map.values()).map(item => cloneValue(item));
  }

  private async syncRepository<T extends EntityWithId>(
    repository: IRepository<T, string>,
    values: Map<string, T>,
  ): Promise<void> {
    const desiredIds = new Set(values.keys());
    const existing = await repository.getAll();

    const deletions = existing.filter(entity => !desiredIds.has(entity.id));
    await Promise.all(deletions.map(entity => repository.delete(entity.id)));

    await Promise.all(
      Array.from(values.values()).map(entity => repository.save(cloneValue(entity))),
    );
  }

  private notifyListeners(): void {
    this.version += 1;

    for (const listener of Array.from(this.listeners)) {
      try {
        listener();
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('ApplicationState listener error', error);
        }
      }
    }
  }
}

export default ApplicationState;
