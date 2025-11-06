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
import type { CaseDisplay } from '@/types/case';
import { legacyCaseDisplayToCase } from '@/application/services/caseLegacyMapper';

type EntityWithId = { id: string };

export interface ApplicationStateSnapshot {
  cases: ReadonlyMap<string, Case>;
  financials: ReadonlyMap<string, FinancialItem>;
  notes: ReadonlyMap<string, Note>;
  alerts: ReadonlyMap<string, Alert>;
  activities: ReadonlyMap<string, ActivityEvent>;
  featureFlags: FeatureFlags;
  casesLoading: boolean;
  casesError: string | null;
  hasLoadedCases: boolean;
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

type SnapshotListener = (snapshot: ApplicationStateSnapshot) => void;
type Listener = SnapshotListener | (() => void);

export class ApplicationState {
  private static instance: ApplicationState | null = null;

  private readonly cases = new Map<string, Case>();
  private readonly financials = new Map<string, FinancialItem>();
  private readonly notes = new Map<string, Note>();
  private readonly alerts = new Map<string, Alert>();
  private readonly activities = new Map<string, ActivityEvent>();
  private featureFlags: FeatureFlags = createFeatureFlagContext();

  private casesLoading = false;
  private casesError: string | null = null;
  private hasLoadedCases = false;

  private financialsLoading = false;
  private financialsError: string | null = null;

  private notesLoading = false;
  private notesError: string | null = null;

  private readonly listeners = new Map<Listener, SnapshotListener>();
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
    return this.createSnapshot();
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

    this.casesLoading = false;
    this.casesError = null;
    this.hasLoadedCases = true;

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

  getCasesLoading(): boolean {
    return this.casesLoading;
  }

  getCasesError(): string | null {
    return this.casesError;
  }

  getHasLoadedCases(): boolean {
    return this.hasLoadedCases;
  }

  setCases(cases: Case[]): void {
    this.replaceCases(cases);
    this.notifyListeners();
  }

  setCasesLoading(loading: boolean): void {
    if (this.casesLoading === loading) {
      return;
    }

    this.casesLoading = loading;
    this.notifyListeners();
  }

  setCasesError(error: string | null | undefined): void {
    const nextError = error ?? null;

    if (this.casesError === nextError) {
      return;
    }

    this.casesError = nextError;
    this.notifyListeners();
  }

  setHasLoadedCases(loaded: boolean): void {
    if (this.hasLoadedCases === loaded) {
      return;
    }

    this.hasLoadedCases = loaded;
    this.notifyListeners();
  }

  setCasesFromLegacyDisplays(displays: CaseDisplay[]): void {
    const nextCases = displays.map(display => legacyCaseDisplayToCase(display, this.cases.get(display.id) ?? null));
    this.replaceCases(nextCases);
    this.notifyListeners();
  }

  upsertCaseFromLegacy(display: CaseDisplay): void {
    const next = legacyCaseDisplayToCase(display, this.cases.get(display.id) ?? null);
    this.cases.set(next.id, next);
    if (!this.hasLoadedCases) {
      this.hasLoadedCases = true;
    }
    this.notifyListeners();
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

  getFinancialItemsByCaseId(caseId: string): FinancialItem[] {
    return this.toArray(this.financials).filter(item => item.caseId === caseId);
  }

  setFinancialItems(items: FinancialItem[]): void {
    this.financials.clear();
    items.forEach(item => {
      this.financials.set(item.id, cloneValue(item));
    });
    this.notifyListeners();
  }

  getFinancialItemsLoading(): boolean {
    return this.financialsLoading;
  }

  setFinancialItemsLoading(loading: boolean): void {
    this.financialsLoading = loading;
    this.notifyListeners();
  }

  getFinancialItemsError(): string | null {
    return this.financialsError;
  }

  setFinancialItemsError(error: string | null): void {
    this.financialsError = error;
    this.notifyListeners();
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

  getNotesByCaseId(caseId: string): Note[] {
    return this.toArray(this.notes).filter(note => note.caseId === caseId);
  }

  setNotes(notes: Note[]): void {
    this.notes.clear();
    notes.forEach(note => {
      this.notes.set(note.id, cloneValue(note));
    });
    this.notifyListeners();
  }

  getNotesLoading(): boolean {
    return this.notesLoading;
  }

  setNotesLoading(loading: boolean): void {
    this.notesLoading = loading;
    this.notifyListeners();
  }

  getNotesError(): string | null {
    return this.notesError;
  }

  setNotesError(error: string | null): void {
    this.notesError = error;
    this.notifyListeners();
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

  addActivity(event: ActivityEvent): void {
    this.upsertActivity(event);
  }

  subscribe(listener: SnapshotListener): () => void;
  subscribe(listener: () => void): () => void;
  subscribe(listener: Listener): () => void {
    const wrapped: SnapshotListener = listener.length > 0
      ? (listener as SnapshotListener)
      : () => {
          (listener as () => void)();
        };

    this.listeners.set(listener, wrapped);

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

  private createSnapshot(): ApplicationStateSnapshot {
    return {
      cases: this.cloneMap(this.cases),
      financials: this.cloneMap(this.financials),
      notes: this.cloneMap(this.notes),
      alerts: this.cloneMap(this.alerts),
      activities: this.cloneMap(this.activities),
      featureFlags: { ...this.featureFlags },
      casesLoading: this.casesLoading,
      casesError: this.casesError,
      hasLoadedCases: this.hasLoadedCases,
    };
  }

  private cloneMap<T extends EntityWithId>(source: Map<string, T>): Map<string, T> {
    return new Map(
      Array.from(source.entries()).map(([id, entity]) => [id, cloneValue(entity)] as const),
    );
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

    if (this.listeners.size === 0) {
      return;
    }

    const snapshot = this.createSnapshot();

    for (const listener of this.listeners.values()) {
      try {
        listener(snapshot);
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('ApplicationState listener error', error);
        }
      }
    }
  }
}

export default ApplicationState;
