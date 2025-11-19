import { describe, it, expect, beforeEach } from 'vitest';
import StorageRepository from '@/infrastructure/storage/StorageRepository';
import type AutosaveFileService from '@/utils/AutosaveFileService';
import { FileStorageService } from '@/utils/services/FileStorageService';
import { normalizeCaseNotes } from '@/utils/normalization';
import { FinancialItem, type FinancialItemSnapshot, FinancialCategory } from '@/domain/financials/entities/FinancialItem';
import { Case, type CaseSnapshot } from '@/domain/cases/entities/Case';
import { CASE_STATUS } from '@/types/case';
import { Note, type NoteSnapshot } from '@/domain/notes/entities/Note';
import { Alert, type AlertSnapshot } from '@/domain/alerts/entities/Alert';
import { ActivityEvent, type ActivityEventSnapshot } from '@/domain/activity/entities/ActivityEvent';

type SnapshotWithId = { id: string } & Record<string, unknown>;

type StorageSnapshot = {
  cases: Case[];
  financials: FinancialItem[];
  notes: Note[];
  alerts: Alert[];
  activities: ActivityEvent[];
  version: number;
  [key: string]: unknown;
};

class MockAutosaveFileService {
  private data: StorageSnapshot | null;
  public writes = 0;

  constructor(initialData?: Partial<StorageSnapshot>) {
    this.data = initialData
      ? ({
          version: initialData.version ?? 1,
          cases: initialData.cases ?? [],
          financials: initialData.financials ?? [],
          notes: initialData.notes ?? [],
          alerts: initialData.alerts ?? [],
          activities: initialData.activities ?? [],
          ...initialData,
        } as StorageSnapshot)
      : null;
  }

  async readFile(): Promise<StorageSnapshot | null> {
    return this.data ? JSON.parse(JSON.stringify(this.data)) : null;
  }

  async readNamedFile(fileName: string): Promise<any> {
    return null;
  }

  async writeFile(payload: StorageSnapshot): Promise<boolean> {
    this.data = JSON.parse(JSON.stringify(payload));
    this.writes += 1;
    return true;
  }
}

function createCase(overrides: Partial<CaseSnapshot> = {}): Case {
  const base: CaseSnapshot = {
    id: 'CASE-001',
    mcn: 'MCN-001',
    name: 'Sample Case',
  status: CASE_STATUS.Active,
    personId: 'PER-001',
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-01-02').toISOString(),
    metadata: {},
  };

  return Case.rehydrate({ ...base, ...overrides });
}

function createFinancialItem(overrides: Partial<FinancialItemSnapshot> = {}): FinancialItem {
  return FinancialItem.create({
    id: overrides.id ?? 'FIN-001',
    caseId: overrides.caseId ?? 'CASE-001',
    category: overrides.category ?? FinancialCategory.Income,
    description: overrides.description ?? 'Sample Income',
    amount: overrides.amount ?? 1250,
    verificationStatus: overrides.verificationStatus ?? 'Verified',
    createdAt: overrides.createdAt ?? new Date('2025-01-05').toISOString(),
    updatedAt: overrides.updatedAt ?? new Date('2025-01-06').toISOString(),
    metadata: overrides.metadata ?? {},
  });
}

function createNote(overrides: Partial<NoteSnapshot> = {}): Note {
  return Note.create({
    id: overrides.id ?? 'NOTE-001',
    caseId: overrides.caseId ?? 'CASE-001',
    category: overrides.category ?? 'general',
    content: overrides.content ?? 'Sample note content',
    createdAt: overrides.createdAt ?? new Date('2025-01-07').toISOString(),
    updatedAt: overrides.updatedAt ?? new Date('2025-01-08').toISOString(),
    authorId: overrides.authorId,
    metadata: overrides.metadata ?? {},
  });
}

function createAlert(overrides: Partial<AlertSnapshot> = {}): Alert {
  return Alert.create({
    id: overrides.id ?? 'ALERT-001',
    mcn: overrides.mcn ?? 'MCN-001',
    caseId: overrides.caseId ?? null,
    status: overrides.status ?? 'new',
    description: overrides.description ?? 'Sample alert',
    createdAt: overrides.createdAt ?? new Date('2025-01-09').toISOString(),
    updatedAt: overrides.updatedAt ?? new Date('2025-01-10').toISOString(),
    metadata: overrides.metadata ?? {},
  });
}

function createActivity(overrides: Partial<ActivityEventSnapshot> = {}): ActivityEvent {
  return ActivityEvent.create({
    id: overrides.id ?? 'ACT-001',
    eventType: overrides.eventType ?? 'case.updated',
    aggregateId: overrides.aggregateId ?? 'CASE-001',
    aggregateType: overrides.aggregateType ?? 'case',
    changes: overrides.changes ?? { status: 'active' },
    timestamp: overrides.timestamp ?? new Date('2025-01-11').toISOString(),
    metadata: overrides.metadata ?? {},
  });
}

function sortSnapshots<T extends { id: string }>(snapshots: T[]): T[] {
  return [...snapshots].sort((a, b) => a.id.localeCompare(b.id));
}

function toSnapshot(value: unknown): SnapshotWithId {
  if (value && typeof value === 'object') {
    const maybeEntity = value as { toJSON?: () => SnapshotWithId };
    if (typeof maybeEntity.toJSON === 'function') {
      return maybeEntity.toJSON();
    }

    return JSON.parse(JSON.stringify(maybeEntity)) as SnapshotWithId;
  }

  throw new Error('Unable to convert value to snapshot for comparison');
}

describe('StorageRepository', () => {
  let mockService: MockAutosaveFileService;
  let repository: StorageRepository;

  beforeEach(() => {
    mockService = new MockAutosaveFileService();
    const fileStorageService = new FileStorageService({
      fileService: mockService as unknown as AutosaveFileService,
      persistNormalizationFixes: false,
      normalizeCaseNotes,
    });
    repository = new StorageRepository(fileStorageService);
  });

  it('saves and retrieves cases with search and deletion support', async () => {
    const caseRepo = repository.cases;
    const sampleCase = createCase();

    await caseRepo.save(sampleCase);
    expect(mockService.writes).toBe(1);

    const fetched = await caseRepo.getById(sampleCase.id);
    const expectedCase = sampleCase.toJSON();
    expectedCase.metadata = {
      ...expectedCase.metadata,
      legacy_caseRecord: {
        id: sampleCase.id,
        mcn: sampleCase.mcn,
        personId: sampleCase.personId,
        status: sampleCase.status,
      },
    };
    expect(fetched?.toJSON()).toEqual(expectedCase);

    const searchResults = await caseRepo.searchCases('Sample');
    expect(searchResults.map(item => item.toJSON())).toEqual([expectedCase]);

    await caseRepo.delete(sampleCase.id);
    expect(mockService.writes).toBe(2);

    const allCases = await caseRepo.getAll();
    expect(allCases).toEqual([]);
  });

  it('manages financial items scoped to a case and category', async () => {
    const caseRepo = repository.cases;
    const financialRepo = repository.financials;
    const caseId = 'CASE-123';
    
    // Create parent case first
    const parentCase = createCase({ id: caseId });
    await caseRepo.save(parentCase);

    const incomeItem = createFinancialItem({ id: 'FIN-INC', caseId, category: FinancialCategory.Income });
    const expenseItem = createFinancialItem({
      id: 'FIN-EXP',
      caseId,
      category: FinancialCategory.Expense,
      amount: 300,
      description: 'Facility expense',
    });

    await financialRepo.save(incomeItem);
    await financialRepo.save(expenseItem);

    const itemsForCase = await financialRepo.getByCaseId(caseId);
    const caseSnapshots = sortSnapshots(itemsForCase.map(toSnapshot));
    const expectedCaseSnapshots = sortSnapshots([toSnapshot(incomeItem), toSnapshot(expenseItem)]);
    expect(caseSnapshots).toEqual(expectedCaseSnapshots);

    const incomeItems = await financialRepo.getByCategory(FinancialCategory.Income);
    expect(incomeItems.map(toSnapshot)).toEqual([toSnapshot(incomeItem)]);

    const allItems = await financialRepo.getAll();
    expect(sortSnapshots(allItems.map(toSnapshot))).toEqual(expectedCaseSnapshots);

    await financialRepo.delete('FIN-INC');
    const remaining = await financialRepo.getAll();
    expect(remaining.map(toSnapshot)).toEqual([toSnapshot(expenseItem)]);
  });

  it('filters notes by category for a case', async () => {
    const caseRepo = repository.cases;
    const noteRepo = repository.notes;
    const caseId = 'CASE-456';

    // Create parent case first
    const parentCase = createCase({ id: caseId });
    await caseRepo.save(parentCase);

    const generalNote = createNote({ id: 'NOTE-GEN', caseId, category: 'general' });
    const statusNote = createNote({ id: 'NOTE-STATUS', caseId, category: 'status' });

    await noteRepo.save(generalNote);
    await noteRepo.save(statusNote);

    const notesForCase = await noteRepo.getByCaseId(caseId);
    const noteSnapshots = sortSnapshots(notesForCase.map(toSnapshot));
    const expectedNotes = sortSnapshots([toSnapshot(generalNote), toSnapshot(statusNote)]);
    expect(noteSnapshots).toEqual(expectedNotes);

    const statusNotes = await noteRepo.filterByCategory(caseId, 'status');
    expect(statusNotes.map(toSnapshot)).toEqual([toSnapshot(statusNote)]);

    // Verify immutability - reloaded notes should still match originals
    const reloaded = await noteRepo.getByCaseId(caseId);
    expect(sortSnapshots(reloaded.map(toSnapshot))).toEqual(expectedNotes);
  });

  it('retrieves alerts by MCN and unmatched status', async () => {
    const alertRepo = repository.alerts;
    const linkedAlert = createAlert({ id: 'ALERT-CASE', mcn: 'MCN-222', caseId: 'CASE-222', status: 'in-progress' });
    const unmatchedAlertA = createAlert({ id: 'ALERT-A', mcn: 'MCN-333', caseId: null, status: 'new' });
    const unmatchedAlertB = createAlert({ id: 'ALERT-B', mcn: 'MCN-333', caseId: null, status: 'new' });

    await alertRepo.save(linkedAlert);
    await alertRepo.save(unmatchedAlertA);
    await alertRepo.save(unmatchedAlertB);

    const alertsForMcn = await alertRepo.findByMCN('MCN-333');
    const expectedUnmatched = sortSnapshots([toSnapshot(unmatchedAlertA), toSnapshot(unmatchedAlertB)]);
    expect(sortSnapshots(alertsForMcn.map(toSnapshot))).toEqual(expectedUnmatched);

    const unmatched = await alertRepo.getUnmatched();
    expect(sortSnapshots(unmatched.map(toSnapshot))).toEqual(expectedUnmatched);

    await alertRepo.delete('ALERT-A');
    const remainingUnmatched = await alertRepo.getUnmatched();
    expect(remainingUnmatched.map(toSnapshot)).toEqual([toSnapshot(unmatchedAlertB)]);
  });

  it('tracks activity events by aggregate and recent order', async () => {
    const activityRepo = repository.activity;
    const baseAggregate = 'CASE-789';
    const events: ActivityEvent[] = [
      createActivity({ id: 'ACT-1', aggregateId: baseAggregate, timestamp: '2025-02-01T10:00:00Z' }),
      createActivity({ id: 'ACT-2', aggregateId: baseAggregate, timestamp: '2025-02-01T12:00:00Z' }),
      createActivity({ id: 'ACT-3', aggregateId: 'CASE-999', timestamp: '2025-02-01T11:00:00Z' }),
      createActivity({ id: 'ACT-4', aggregateId: baseAggregate, timestamp: '2025-02-01T13:00:00Z' }),
    ];

    for (const event of events) {
      await activityRepo.save(event);
    }

    const aggregateEvents = await activityRepo.getByAggregateId(baseAggregate);
    const expectedAggregate = sortSnapshots([
      { ...toSnapshot(events[0]), payload: {} },
      { ...toSnapshot(events[1]), payload: {} },
      { ...toSnapshot(events[3]), payload: {} },
    ]);
    expect(sortSnapshots(aggregateEvents.map(toSnapshot))).toEqual(expectedAggregate);

    const recentTwo = await activityRepo.getRecent(2);
    expect(recentTwo.map(toSnapshot)).toEqual([
      { ...toSnapshot(events[3]), payload: {} },
      { ...toSnapshot(events[1]), payload: {} },
    ]);
  });
});
