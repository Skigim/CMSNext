import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ApplicationState from '@/application/ApplicationState';
import type StorageRepository from '@/infrastructure/storage/StorageRepository';
import { Case, type CaseSnapshot } from '@/domain/cases/entities/Case';
import { CASE_STATUS } from '@/types/case';
import { FinancialItem, type FinancialItemSnapshot, FinancialCategory } from '@/domain/financials/entities/FinancialItem';
import { Note, type NoteSnapshot } from '@/domain/notes/entities/Note';
import { Alert, type AlertSnapshot } from '@/domain/alerts/entities/Alert';
import { ActivityEvent, type ActivityEventSnapshot } from '@/domain/activity/entities/ActivityEvent';
import { DEFAULT_FLAGS } from '@/utils/featureFlags';
type RepositoryStub<T extends { id: string }> = {
  data: T[];
  getAll: () => Promise<T[]>;
  save: (entity: T) => Promise<void>;
  delete: (id: string) => Promise<void>;
};

type StorageData = {
  cases?: Case[];
  financials?: FinancialItem[];
  notes?: Note[];
  alerts?: Alert[];
  activities?: ActivityEvent[];
};

type StorageStub = {
  storage: StorageRepository;
  repos: {
    cases: RepositoryStub<Case>;
    financials: RepositoryStub<FinancialItem>;
    notes: RepositoryStub<Note>;
    alerts: RepositoryStub<Alert>;
    activity: RepositoryStub<ActivityEvent>;
  };
};

function cloneEntity<T>(entity: T): T {
  if (entity instanceof Case) {
    return entity.clone() as T;
  }

  return JSON.parse(JSON.stringify(entity)) as T;
}

function createRepositoryStub<T extends { id: string }>(initial: T[] = []): RepositoryStub<T> {
  const data: T[] = initial.map(entity => cloneEntity(entity));

  return {
    data,
    getAll: vi.fn(async () => data.map(entity => cloneEntity(entity))),
    save: vi.fn(async (entity: T) => {
      const index = data.findIndex(item => item.id === entity.id);
      if (index >= 0) {
        data[index] = cloneEntity(entity);
      } else {
        data.push(cloneEntity(entity));
      }
    }),
    delete: vi.fn(async (id: string) => {
      const index = data.findIndex(item => item.id === id);
      if (index >= 0) {
        data.splice(index, 1);
      }
    }),
  } satisfies RepositoryStub<T>;
}

function createStorageStub(initial: StorageData = {}): StorageStub {
  const cases = createRepositoryStub(initial.cases ?? []);
  const financials = createRepositoryStub(initial.financials ?? []);
  const notes = createRepositoryStub(initial.notes ?? []);
  const alerts = createRepositoryStub(initial.alerts ?? []);
  const activity = createRepositoryStub(initial.activities ?? []);

  const storage = {
    cases: cases as unknown,
    financials: financials as unknown,
    notes: notes as unknown,
    alerts: alerts as unknown,
    activity: activity as unknown,
    getFeatureFlags: vi.fn(async () => ({})),
    saveFeatureFlags: vi.fn(async () => {}),
  } as unknown as StorageRepository;

  return {
    storage,
    repos: { cases, financials, notes, alerts, activity },
  };
}

function createTestCase(overrides: Partial<CaseSnapshot> = {}): Case {
  const base: CaseSnapshot = {
    id: 'CASE-001',
    mcn: 'MCN-001',
    name: 'Test Case',
  status: CASE_STATUS.Active,
    personId: 'PER-001',
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-01-02').toISOString(),
    metadata: {},
  };

  return Case.rehydrate({ ...base, ...overrides });
}

function createTestFinancial(overrides: Partial<FinancialItemSnapshot> = {}): FinancialItem {
  return FinancialItem.create({
    id: overrides.id ?? 'FIN-001',
    caseId: overrides.caseId ?? 'CASE-001',
    category: overrides.category ?? FinancialCategory.Income,
    description: overrides.description ?? 'Income',
    amount: overrides.amount ?? 800,
    verificationStatus: overrides.verificationStatus ?? 'Verified',
    createdAt: overrides.createdAt ?? new Date('2025-01-05').toISOString(),
    updatedAt: overrides.updatedAt ?? new Date('2025-01-06').toISOString(),
    metadata: overrides.metadata ?? {},
  });
}

function createTestNote(overrides: Partial<NoteSnapshot> = {}): Note {
  return Note.create({
    id: overrides.id ?? 'NOTE-001',
    caseId: overrides.caseId ?? 'CASE-001',
    category: overrides.category ?? 'general',
    content: overrides.content ?? 'Initial note',
    createdAt: overrides.createdAt ?? new Date('2025-01-07').toISOString(),
    updatedAt: overrides.updatedAt ?? new Date('2025-01-08').toISOString(),
    authorId: overrides.authorId,
    metadata: overrides.metadata ?? {},
  });
}

function createTestAlert(overrides: Partial<AlertSnapshot> = {}): Alert {
  return Alert.create({
    id: overrides.id ?? 'ALERT-001',
    mcn: overrides.mcn ?? 'MCN-001',
    caseId: overrides.caseId ?? null,
    status: overrides.status ?? 'new',
    description: overrides.description ?? 'Test alert',
    createdAt: overrides.createdAt ?? new Date('2025-01-09').toISOString(),
    updatedAt: overrides.updatedAt ?? new Date('2025-01-10').toISOString(),
    metadata: overrides.metadata ?? {},
  });
}

function createTestActivity(overrides: Partial<ActivityEventSnapshot> = {}): ActivityEvent {
  return ActivityEvent.create({
    id: overrides.id ?? 'ACT-001',
    eventType: overrides.eventType ?? 'case.created',
    aggregateId: overrides.aggregateId ?? 'CASE-001',
    aggregateType: overrides.aggregateType ?? 'case',
    changes: overrides.changes ?? { status: 'active' },
    timestamp: overrides.timestamp ?? new Date('2025-01-11').toISOString(),
    metadata: overrides.metadata ?? {},
  });
}

describe('ApplicationState', () => {
  beforeEach(() => {
    ApplicationState.resetInstance();
  });

  afterEach(() => {
    ApplicationState.resetInstance();
  });

  it('maintains singleton instance semantics', () => {
    const instanceA = ApplicationState.getInstance();
    const instanceB = ApplicationState.getInstance();

    expect(instanceA).toBe(instanceB);
  });

  it('notifies listeners when state mutates', () => {
    const appState = ApplicationState.getInstance();
    const listener = vi.fn();

    const unsubscribe = appState.subscribe(listener);
  appState.addCase(createTestCase());

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    appState.updateCase('CASE-001', { name: 'Updated Name' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('hydrates all domain collections from storage and clones values', async () => {
    const seedCase = createTestCase();
    const seedFinancial = createTestFinancial();
    const seedNote = createTestNote();
    const seedAlert = createTestAlert();
    const seedActivity = createTestActivity();

    const { storage } = createStorageStub({
      cases: [seedCase],
      financials: [seedFinancial],
      notes: [seedNote],
      alerts: [seedAlert],
      activities: [seedActivity],
    });

    const appState = ApplicationState.getInstance();
    const listener = vi.fn();
    appState.subscribe(listener);

    await appState.hydrate(storage);

    expect(appState.getCases().map(item => item.toJSON())).toEqual([seedCase.toJSON()]);
    expect(appState.getFinancialItems().map(item => item.id)).toEqual([seedFinancial.id]);
    expect(appState.getNotes().map(item => item.id)).toEqual([seedNote.id]);
    expect(appState.getAlerts().map(item => item.id)).toEqual([seedAlert.id]);
    expect(appState.getActivities().map(item => item.id)).toEqual([seedActivity.id]);
    expect(listener).toHaveBeenCalledTimes(1);

  const cases = appState.getCases();
  cases[0].updateStatus(CASE_STATUS.Pending);
  expect(appState.getCase(seedCase.id)?.status).toBe(seedCase.status);
  });

  it('persists state to storage with saves and deletions', async () => {
    const existingCase = createTestCase({ id: 'CASE-LEGACY', name: 'Legacy Case' });
    const { storage, repos } = createStorageStub({ cases: [existingCase] });

    const appState = ApplicationState.getInstance();
    const activeCase = createTestCase({ id: 'CASE-NEW', name: 'New Case' });
    const activeFinancial = createTestFinancial({ id: 'FIN-NEW', caseId: 'CASE-NEW' });
    const activeNote = createTestNote({ id: 'NOTE-NEW', caseId: 'CASE-NEW' });
    const activeAlert = createTestAlert({ id: 'ALERT-NEW', caseId: 'CASE-NEW', status: 'in-progress' });
    const activeActivity = createTestActivity({ id: 'ACT-NEW', aggregateId: 'CASE-NEW' });

    appState.addCase(activeCase);
    appState.upsertFinancialItem(activeFinancial);
    appState.upsertNote(activeNote);
    appState.upsertAlert(activeAlert);
    appState.upsertActivity(activeActivity);

    await appState.persist(storage);

    expect(repos.cases.delete).toHaveBeenCalledWith('CASE-LEGACY');
  expect(repos.cases.save).toHaveBeenCalledWith(expect.any(Case));
    expect(repos.financials.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'FIN-NEW' }));
    expect(repos.notes.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'NOTE-NEW' }));
    expect(repos.alerts.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'ALERT-NEW' }));
    expect(repos.activity.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'ACT-NEW' }));
  });

  it('returns default feature flags and clones the result', () => {
    const appState = ApplicationState.getInstance();

    const flags = appState.getFeatureFlags();

    expect(flags).toEqual(DEFAULT_FLAGS);
    expect(flags).not.toBe(DEFAULT_FLAGS);
  });

  it('applies feature flag updates immutably and notifies listeners only on change', () => {
    const appState = ApplicationState.getInstance();
    const listener = vi.fn();
    const unsubscribe = appState.subscribe(listener);

    expect(appState.isFeatureEnabled('dashboard.widgets.casePriority')).toBe(true);

    appState.setFeatureFlags({ 'dashboard.widgets.casePriority': false });

    expect(appState.isFeatureEnabled('dashboard.widgets.casePriority')).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    appState.setFeatureFlags({ 'dashboard.widgets.casePriority': false });

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
