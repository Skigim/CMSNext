import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertsService } from '@/utils/services/AlertsService';
import type { AlertWithMatch } from '@/utils/alertsData';
import type { CaseDisplay } from '@/types/case';
import { parseAlertsFromCsv } from '@/utils/alerts/alertsCsvParser';

// Mock the CSV parser globally
vi.mock('@/utils/alerts/alertsCsvParser', () => ({
  parseAlertsFromCsv: vi.fn().mockReturnValue({
    alerts: [],
    summary: { total: 0, matched: 0, unmatched: 0, missingMcn: 0 },
    alertsByCaseId: new Map(),
    unmatched: [],
    missingMcn: [],
  }),
}));

describe('AlertsService', () => {
  let service: AlertsService;

  const createMockCase = (id: string, mcn: string): CaseDisplay => ({
    id,
    name: `Case ${id}`,
    status: 'pending' as const,
    mcn,
    caseRecord: { mcn } as any,
    priority: false,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  } as unknown as CaseDisplay);

  const createMockAlert = (id: string, mcNumber?: string | null): AlertWithMatch => ({
    id,
    reportId: `REPORT-${id}`,
    description: `Alert ${id} description`,
    alertType: 'standard',
    alertCode: `CODE-${id}`,
    mcNumber: mcNumber === undefined ? null : mcNumber,
    status: 'new',
    matchStatus: 'unmatched',
    alertDate: '2024-01-15',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  });

  const mockParsedCsvResult = (incomingAlert: AlertWithMatch, matchedCaseId?: string) => {
    vi.mocked(parseAlertsFromCsv).mockReturnValue({
      alerts: [incomingAlert],
      summary: {
        total: 1,
        matched: matchedCaseId ? 1 : 0,
        unmatched: matchedCaseId ? 0 : 1,
        missingMcn: 0,
      },
      alertsByCaseId: matchedCaseId ? new Map([[matchedCaseId, [incomingAlert]]]) : new Map(),
      unmatched: matchedCaseId ? [] : [incomingAlert],
      missingMcn: [],
    });
  };

  const createReimportAlertPair = (options: {
    alertId: string;
    mcNumber: string;
    description: string;
    initialStatus?: AlertWithMatch['status'];
    matchedCaseId: string;
  }) => {
    const existingAlert: AlertWithMatch = {
      ...createMockAlert(options.alertId, options.mcNumber),
      description: options.description,
      matchStatus: 'unmatched',
      reportId: options.alertId,
      status: options.initialStatus ?? 'new',
    };

    const incomingAlert: AlertWithMatch = {
      ...existingAlert,
      matchStatus: 'matched',
      matchedCaseId: options.matchedCaseId,
      matchedCaseName: `Case ${options.matchedCaseId}`,
    };

    return { existingAlert, incomingAlert };
  };

  beforeEach(() => {
    service = new AlertsService();
  });

  describe('getAlertsIndex', () => {
    it('should return empty index when no alerts exist', () => {
      const cases: CaseDisplay[] = [];
      const alerts: AlertWithMatch[] = [];
      const result = service.getAlertsIndex(alerts, cases);

      expect(result.alerts).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });

    it('should match alerts to cases by MCN', () => {
      const cases = [createMockCase('case-1', 'MCN-123')];
      const alerts = [createMockAlert('alert-1', 'MCN-123')];

      const result = service.getAlertsIndex(alerts, cases);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].matchStatus).toBe('matched');
      expect(result.alerts[0].matchedCaseId).toBe('case-1');
      expect(result.summary.matched).toBe(1);
    });

    it('should classify alerts without MCN as missing-mcn', () => {
      const cases = [createMockCase('case-1', 'MCN-123')];
      const alerts = [createMockAlert('alert-1', null)];

      const result = service.getAlertsIndex(alerts, cases);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].matchStatus).toBe('missing-mcn');
      expect(result.summary.missingMcn).toBe(1);
    });

    it('should rematch alerts when cases change', () => {
      const alerts = [{ ...createMockAlert('alert-1', 'MCN-123'), matchStatus: 'matched' as const, matchedCaseId: 'old-case' }];
      const newCases = [createMockCase('new-case', 'MCN-123')];
      
      const result = service.getAlertsIndex(alerts, newCases);

      expect(result.alerts[0].matchedCaseId).toBe('new-case');
    });
  });

  describe('updateAlertStatus', () => {
    it('should update alert status by ID', () => {
      const alert = createMockAlert('alert-1', 'MCN-123');
      const alerts = [alert];
      const cases: CaseDisplay[] = [];
      
      const result = service.updateAlertStatus(alerts, 'alert-1', { status: 'resolved' }, cases);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('resolved');
      expect(result?.resolvedAt).toBeTruthy();
    });

    it('should update correct alert by ID when multiple alerts share same fallback keys', () => {
      // Simulates stacked CSV imports where multiple alerts have same reportId/description
      // but different IDs. The bug was using buildAlertStorageKey which could match multiple.
      const alert1 = {
        ...createMockAlert('alert-uuid-1', 'MCN-123'),
        reportId: 'SHARED-REPORT',
        description: 'Same description',
      };
      const alert2 = {
        ...createMockAlert('alert-uuid-2', 'MCN-123'),
        reportId: 'SHARED-REPORT',
        description: 'Same description',
      };
      const alerts = [alert1, alert2];
      const cases: CaseDisplay[] = [];
      
      // Update by exact ID should work even when fallback keys collide
      const result = service.updateAlertStatus(alerts, 'alert-uuid-2', { status: 'resolved' }, cases);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('alert-uuid-2');
      expect(result?.status).toBe('resolved');
    });

    it('should auto-set resolvedAt when marking as resolved', () => {
      const alert = createMockAlert('alert-1', 'MCN-123');
      const alerts = [alert];
      const cases: CaseDisplay[] = [];
      
      const result = service.updateAlertStatus(alerts, 'alert-1', { status: 'resolved' }, cases);

      expect(result?.resolvedAt).toBeTruthy();
      const resolvedDate = new Date(result!.resolvedAt!);
      expect(resolvedDate.getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it('should clear resolvedAt when status is not resolved', () => {
      const alert = {
        ...createMockAlert('alert-1', 'MCN-123'),
        status: 'resolved' as const,
        resolvedAt: '2024-01-15T10:00:00Z',
      };
      const alerts = [alert];
      const cases: CaseDisplay[] = [];
      
      const result = service.updateAlertStatus(alerts, 'alert-1', { status: 'new' }, cases);

      expect(result?.status).toBe('new');
      expect(result?.resolvedAt).toBeNull();
    });

    it('should return null if alert not found', () => {
      const alerts: AlertWithMatch[] = [];
      const cases: CaseDisplay[] = [];
      
      const result = service.updateAlertStatus(alerts, 'nonexistent', { status: 'resolved' }, cases);

      expect(result).toBeNull();
    });

    it('should match alert by reportId if ID not found', () => {
      const alert = createMockAlert('alert-1', 'MCN-123');
      const alerts = [alert];
      const cases: CaseDisplay[] = [];
      
      const result = service.updateAlertStatus(alerts, 'REPORT-alert-1', { status: 'resolved' }, cases);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('alert-1');
    });

    it('should preserve existing caseId when case is not in lookup (skeleton case race condition)', () => {
      // This test covers the scenario where:
      // 1. Alert was matched to a skeleton case during import
      // 2. User tries to resolve the alert
      // 3. React state hasn't synced yet, so skeleton case isn't in the cases array
      // 4. The alert's caseId should be preserved, not cleared
      const skeletonCaseId = 'skeleton-case-123';
      const alert: AlertWithMatch = {
        ...createMockAlert('alert-1', 'MCN-123'),
        caseId: skeletonCaseId,
        matchedCaseId: skeletonCaseId,
        matchedCaseName: 'Doe, John',
        matchStatus: 'matched',
      };
      const alerts = [alert];
      // Empty cases array simulates React state not having synced yet
      const cases: CaseDisplay[] = [];
      
      const result = service.updateAlertStatus(alerts, 'alert-1', { status: 'resolved' }, cases);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('resolved');
      // Key assertion: caseId should be preserved even though case wasn't in lookup
      expect(result?.caseId).toBe(skeletonCaseId);
      expect(result?.matchedCaseId).toBe(skeletonCaseId);
    });
  });

  describe('pruneResolvedAlerts', () => {
    const now = new Date('2026-02-24T00:00:00.000Z');
    const retentionDays = 14;
    const runPrune = (alerts: AlertWithMatch[], customRetentionDays = retentionDays) =>
      service.pruneResolvedAlerts(alerts, customRetentionDays, now);

    it.each([
      {
        testName: 'keeps open alerts regardless of age',
        alerts: [{ ...createMockAlert('open-old', 'MCN-123'), status: 'new' as const, resolvedAt: '2020-01-01T00:00:00.000Z' }],
        expectedPruned: 0,
        expectedIds: ['open-old'],
      },
      {
        testName: 'keeps resolved alerts resolved fewer than 14 days ago',
        alerts: [{ ...createMockAlert('resolved-recent', 'MCN-123'), status: 'resolved' as const, resolvedAt: '2026-02-11T00:00:00.000Z' }],
        expectedPruned: 0,
        expectedIds: ['resolved-recent'],
      },
      {
        testName: 'prunes resolved alerts resolved exactly 14 days ago',
        alerts: [{ ...createMockAlert('resolved-boundary', 'MCN-123'), status: 'resolved' as const, resolvedAt: '2026-02-10T00:00:00.000Z' }],
        expectedPruned: 1,
        expectedIds: [],
      },
      {
        testName: 'prunes resolved alerts resolved more than 14 days ago',
        alerts: [{ ...createMockAlert('resolved-old', 'MCN-123'), status: 'resolved' as const, resolvedAt: '2026-02-09T00:00:00.000Z' }],
        expectedPruned: 1,
        expectedIds: [],
      },
      {
        testName: 'keeps resolved alerts with null resolvedAt',
        alerts: [{ ...createMockAlert('resolved-no-date', 'MCN-123'), status: 'resolved' as const, resolvedAt: null }],
        expectedPruned: 0,
        expectedIds: ['resolved-no-date'],
      },
    ])('$testName', ({ alerts, expectedPruned, expectedIds }) => {
      const result = runPrune(alerts);

      expect(result.pruned).toBe(expectedPruned);
      expect(result.alerts.map(alert => alert.id)).toEqual(expectedIds);
    });

    it('respects custom retentionDays values', () => {
      const alerts: AlertWithMatch[] = [
        { ...createMockAlert('resolved-31-days', 'MCN-123'), status: 'resolved', resolvedAt: '2026-01-24T00:00:00.000Z' },
        { ...createMockAlert('resolved-29-days', 'MCN-123'), status: 'resolved', resolvedAt: '2026-01-26T00:00:00.000Z' },
      ];

      const result = runPrune(alerts, 30);

      expect(result.pruned).toBe(1);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].id).toBe('resolved-29-days');
    });
  });

  describe('mergeAlertsFromCsvContent', () => {
    it('should merge new alerts from CSV', async () => {
      const existingAlert = createMockAlert('alert-1', 'MCN-123');
      const existingAlerts = [existingAlert];
      const cases: CaseDisplay[] = [];
      const csvContent = 'MCN,Description\nMCN-999,New alert';

      // Mock parser to return a new alert
      const newAlert = createMockAlert('alert-2', 'MCN-999');
      vi.mocked(parseAlertsFromCsv).mockReturnValue({
        alerts: [newAlert],
        summary: { total: 1, matched: 0, unmatched: 1, missingMcn: 0 },
        alertsByCaseId: new Map(),
        unmatched: [newAlert],
        missingMcn: [],
      });

      const result = await service.mergeAlertsFromCsvContent(csvContent, existingAlerts, cases);

      // Should have both existing and new alert
      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.added).toBe(1);
    });

    it('should auto-resolve alerts with missing MCN during merge', async () => {
      const alertWithoutMcn = createMockAlert('alert-no-mcn', null);
      
      vi.mocked(parseAlertsFromCsv).mockReturnValue({
        alerts: [alertWithoutMcn],
        summary: { total: 1, matched: 0, unmatched: 0, missingMcn: 1 },
        alertsByCaseId: new Map(),
        unmatched: [],
        missingMcn: [alertWithoutMcn],
      });

      const existingAlerts: AlertWithMatch[] = [];
      const cases: CaseDisplay[] = [];
      const csvContent = 'Description\nAlert without MCN';

      const result = await service.mergeAlertsFromCsvContent(csvContent, existingAlerts, cases);

      expect(result.added).toBe(1);
      expect(result.total).toBe(1);
      
      // Verify the alert was auto-resolved due to missing MCN
      expect(result.alerts[0].status).toBe('resolved');
      expect(result.alerts[0].resolvedAt).toBeTruthy();
      expect(result.alerts[0].resolutionNotes).toContain('Missing MCN');
    });

    it('should deduplicate alerts during merge', async () => {
      const alert = createMockAlert('alert-1', 'MCN-123');
      const existingAlerts = [alert];
      const cases: CaseDisplay[] = [];
      const csvContent = 'MCN,Description\nMCN-123,Same alert';

      // Mock parser to return the same alert
      const alertsByCaseId = new Map();
      alertsByCaseId.set('case-1', [alert]);
      vi.mocked(parseAlertsFromCsv).mockReturnValue({
        alerts: [alert],
        summary: { total: 1, matched: 1, unmatched: 0, missingMcn: 0 },
        alertsByCaseId,
        unmatched: [],
        missingMcn: [],
      });

      const result = await service.mergeAlertsFromCsvContent(csvContent, existingAlerts, cases);

      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.added).toBe(0);
    });
  });

  describe("mergeAlertsFromCsvContent - exact ID matching across matchStatus changes", () => {
    it("does not create duplicate IDs when the same alert is re-imported after its matchStatus changed", async () => {
      const alertId = "ALERT-NUM-42";
      const { existingAlert, incomingAlert } = createReimportAlertPair({
        alertId,
        mcNumber: 'MCN-999',
        description: 'Benefit calculation discrepancy',
        matchedCaseId: 'case-100',
      });
      incomingAlert.alertDate = '2024-06-15';
      existingAlert.alertDate = '2024-06-15';
      incomingAlert.matchedCaseName = 'Smith, Jane';
      mockParsedCsvResult(incomingAlert, 'case-100');

      // ACT
      const result = await service.mergeAlertsFromCsvContent(
        "dummy-csv-content",
        [existingAlert],
        [],
      );

      // ASSERT – should be 0 added (matched to existing), 1 updated, no duplicate IDs
      expect(result.added).toBe(0);
      expect(result.updated).toBe(1);
      expect(result.total).toBe(1);

      const uniqueIds = new Set(result.alerts.map(a => a.id));
      expect(uniqueIds.size).toBe(result.alerts.length);
      expect(uniqueIds.has(alertId)).toBe(true);
    });

    it("does not create duplicate IDs when strong key differs only by matchStatus (empty description)", async () => {
      const alertId = "BARE-ALERT-7";
      const { existingAlert, incomingAlert } = createReimportAlertPair({
        alertId,
        mcNumber: 'MCN-456',
        description: '',
        initialStatus: 'in-progress',
        matchedCaseId: 'case-200',
      });
      incomingAlert.status = 'new';
      mockParsedCsvResult(incomingAlert, 'case-200');

      // ACT
      const result = await service.mergeAlertsFromCsvContent(
        "dummy-csv-content",
        [existingAlert],
        [],
      );

      // ASSERT – no duplicate IDs; existing workflow status should be preserved (in-progress > new)
      expect(result.updated).toBe(1);
      expect(result.total).toBe(1);
      const ids = result.alerts.map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      expect(result.alerts[0]?.status).toBe('in-progress');
    });
  });


  describe('Alert matching logic', () => {
    it('should normalize MCN for matching', () => {
      const cases = [createMockCase('case-1', ' mcn-123 ')]; // Extra whitespace
      const alerts = [createMockAlert('alert-1', 'MCN-123')]; // Different case

      const result = service.getAlertsIndex(alerts, cases);

      expect(result.alerts[0].matchStatus).toBe('matched');
    });

    it('should handle multiple alerts with same MCN', () => {
      const cases = [createMockCase('case-1', 'MCN-123')];
      const alerts = [
        createMockAlert('alert-1', 'MCN-123'),
        createMockAlert('alert-2', 'MCN-123'),
      ];

      const result = service.getAlertsIndex(alerts, cases);

      expect(result.alerts.filter(a => a.matchStatus === 'matched')).toHaveLength(2);
      expect(result.summary.matched).toBe(2);
    });
  });

  describe('Workflow state management', () => {
    it('should preserve existing workflow status during rematch', () => {
      const alert = {
        ...createMockAlert('alert-1', 'MCN-123'),
        status: 'resolved' as const,
        resolvedAt: '2024-01-15T10:00:00Z',
        resolutionNotes: 'Fixed issue',
      };
      const alerts = [alert];
      const cases = [createMockCase('case-1', 'MCN-123')];
      
      const result = service.getAlertsIndex(alerts, cases);

      expect(result.alerts[0].status).toBe('resolved');
      expect(result.alerts[0].resolvedAt).toBe('2024-01-15T10:00:00Z');
      expect(result.alerts[0].resolutionNotes).toBe('Fixed issue');
    });
  });
});
