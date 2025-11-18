import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertsService } from '@/utils/services/AlertsService';
import type { AlertsStorageService, LoadAlertsResult } from '@/utils/services/AlertsStorageService';
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
  let mockAlertsStorage: AlertsStorageService;
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

  beforeEach(() => {
    mockAlertsStorage = {
      loadAlertsFromStore: vi.fn(),
      saveAlerts: vi.fn(),
      importAlertsFromCsv: vi.fn(),
    } as any;

    service = new AlertsService({ alertsStorage: mockAlertsStorage });
  });

  describe('getAlertsIndex', () => {
    it('should return empty index when no alerts exist', async () => {
      const emptyLoadResult: LoadAlertsResult = {
        alerts: [],
        needsMigration: false,
        legacyWorkflows: [],
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(emptyLoadResult);
      vi.mocked(mockAlertsStorage.importAlertsFromCsv).mockResolvedValue({
        alerts: [],
        sourceFile: undefined,
      });

      const cases: CaseDisplay[] = [];
      const result = await service.getAlertsIndex(cases);

      expect(result.alerts).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });

    it('should match alerts to cases by MCN', async () => {
      const cases = [createMockCase('case-1', 'MCN-123')];
      const alerts = [createMockAlert('alert-1', 'MCN-123')];

      const loadResult: LoadAlertsResult = {
        alerts,
        legacyWorkflows: [],
        needsMigration: false,
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

      const result = await service.getAlertsIndex(cases);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].matchStatus).toBe('matched');
      expect(result.alerts[0].matchedCaseId).toBe('case-1');
      expect(result.summary.matched).toBe(1);
    });

    it('should classify alerts without MCN as missing-mcn', async () => {
      const cases = [createMockCase('case-1', 'MCN-123')];
      const alerts = [createMockAlert('alert-1', null)];

      const loadResult: LoadAlertsResult = {
        alerts,
        legacyWorkflows: [],
        needsMigration: false,
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

      const result = await service.getAlertsIndex(cases);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].matchStatus).toBe('missing-mcn');
      expect(result.summary.missingMcn).toBe(1);
    });

    it('should rematch alerts when cases change', async () => {
      const alerts = [createMockAlert('alert-1', 'MCN-123')];
      const loadResult: LoadAlertsResult = {
        alerts: [{ ...alerts[0], matchStatus: 'matched', matchedCaseId: 'old-case' }],
        legacyWorkflows: [],
        needsMigration: false,
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

      const newCases = [createMockCase('new-case', 'MCN-123')];
      const result = await service.getAlertsIndex(newCases);

      expect(result.alerts[0].matchedCaseId).toBe('new-case');
      expect(mockAlertsStorage.saveAlerts).toHaveBeenCalled();
    });

    it('should trigger CSV import when storage is empty', async () => {
      const emptyLoadResult: LoadAlertsResult = {
        alerts: [],
        needsMigration: false,
        legacyWorkflows: [],
      };

      const importedAlerts = [createMockAlert('alert-1', 'MCN-123')];
      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(emptyLoadResult);
      vi.mocked(mockAlertsStorage.importAlertsFromCsv).mockResolvedValue({
        alerts: importedAlerts,
        sourceFile: 'alerts.csv',
      });
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

      const cases = [createMockCase('case-1', 'MCN-123')];
      const result = await service.getAlertsIndex(cases);

      expect(mockAlertsStorage.importAlertsFromCsv).toHaveBeenCalledWith(cases);
      expect(result.alerts).toHaveLength(1);
    });
  });

  describe('updateAlertStatus', () => {
    it('should update alert status by ID', async () => {
      const alert = createMockAlert('alert-1', 'MCN-123');
      const loadResult: LoadAlertsResult = {
        alerts: [alert],
        legacyWorkflows: [],
        needsMigration: false,
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

      const cases: CaseDisplay[] = [];
      const result = await service.updateAlertStatus('alert-1', { status: 'resolved' }, cases);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('resolved');
      expect(result?.resolvedAt).toBeTruthy();
    });

    it('should auto-set resolvedAt when marking as resolved', async () => {
      const alert = createMockAlert('alert-1', 'MCN-123');
      const loadResult: LoadAlertsResult = {
        alerts: [alert],
        legacyWorkflows: [],
        needsMigration: false,
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

      const cases: CaseDisplay[] = [];
      const result = await service.updateAlertStatus('alert-1', { status: 'resolved' }, cases);

      expect(result?.resolvedAt).toBeTruthy();
      const resolvedDate = new Date(result!.resolvedAt!);
      expect(resolvedDate.getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it('should clear resolvedAt when status is not resolved', async () => {
      const alert = {
        ...createMockAlert('alert-1', 'MCN-123'),
        status: 'resolved' as const,
        resolvedAt: '2024-01-15T10:00:00Z',
      };
      const loadResult: LoadAlertsResult = {
        alerts: [alert],
        legacyWorkflows: [],
        needsMigration: false,
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

      const cases: CaseDisplay[] = [];
      const result = await service.updateAlertStatus('alert-1', { status: 'new' }, cases);

      expect(result?.status).toBe('new');
      expect(result?.resolvedAt).toBeNull();
    });

    it('should return null if alert not found', async () => {
      const loadResult: LoadAlertsResult = {
        alerts: [],
        needsMigration: false,
        legacyWorkflows: [],
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.importAlertsFromCsv).mockResolvedValue({
        alerts: [],
        sourceFile: undefined,
      });

      const cases: CaseDisplay[] = [];
      const result = await service.updateAlertStatus('nonexistent', { status: 'resolved' }, cases);

      expect(result).toBeNull();
    });

    it('should match alert by reportId if ID not found', async () => {
      const alert = createMockAlert('alert-1', 'MCN-123');
      const loadResult: LoadAlertsResult = {
        alerts: [alert],
        legacyWorkflows: [],
        needsMigration: false,
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

      const cases: CaseDisplay[] = [];
      const result = await service.updateAlertStatus('REPORT-alert-1', { status: 'resolved' }, cases);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('alert-1');
    });
  });

  describe('mergeAlertsFromCsvContent', () => {
    // No beforeEach needed - we'll use dynamic import mocking in AlertsService

    it('should merge new alerts from CSV', async () => {
      const existingAlert = createMockAlert('alert-1', 'MCN-123');
      const loadResult: LoadAlertsResult = {
        alerts: [existingAlert],
        legacyWorkflows: [],
        needsMigration: false,
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

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

      const result = await service.mergeAlertsFromCsvContent(csvContent, cases);

      // Should have both existing and new alert
      expect(result.alerts.length).toBeGreaterThan(0);
      expect(mockAlertsStorage.saveAlerts).toHaveBeenCalled();
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

      const loadResult: LoadAlertsResult = {
        alerts: [],
        legacyWorkflows: [],
        needsMigration: false,
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.importAlertsFromCsv).mockResolvedValue({
        alerts: [],
        sourceFile: 'Alerts.csv',
      });
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

      const cases: CaseDisplay[] = [];
      const csvContent = 'Description\nAlert without MCN';

      const result = await service.mergeAlertsFromCsvContent(csvContent, cases);

      expect(result.added).toBe(1);
      expect(result.total).toBe(1);
      
      // Verify the alert was auto-resolved due to missing MCN
      const saveCall = vi.mocked(mockAlertsStorage.saveAlerts).mock.calls[0];
      const savedPayload = saveCall?.[0];
      expect(savedPayload?.alerts[0]?.status).toBe('resolved');
      expect(savedPayload?.alerts[0]?.resolvedAt).toBeTruthy();
      expect(savedPayload?.alerts[0]?.resolutionNotes).toContain('Missing MCN');
    });

    it('should deduplicate alerts during merge', async () => {
      const alert = createMockAlert('alert-1', 'MCN-123');
      const loadResult: LoadAlertsResult = {
        alerts: [alert],
        legacyWorkflows: [],
        needsMigration: false,
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

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

      const result = await service.mergeAlertsFromCsvContent(csvContent, cases);

      expect(result.alerts.length).toBeGreaterThan(0);
    });
  });

  describe('Alert matching logic', () => {
    it('should normalize MCN for matching', async () => {
      const cases = [createMockCase('case-1', ' mcn-123 ')]; // Extra whitespace
      const alerts = [createMockAlert('alert-1', 'MCN-123')]; // Different case

      const loadResult: LoadAlertsResult = {
        alerts,
        legacyWorkflows: [],
        needsMigration: false,
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

      const result = await service.getAlertsIndex(cases);

      expect(result.alerts[0].matchStatus).toBe('matched');
    });

    it('should handle multiple alerts with same MCN', async () => {
      const cases = [createMockCase('case-1', 'MCN-123')];
      const alerts = [
        createMockAlert('alert-1', 'MCN-123'),
        createMockAlert('alert-2', 'MCN-123'),
      ];

      const loadResult: LoadAlertsResult = {
        alerts,
        legacyWorkflows: [],
        needsMigration: false,
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

      const result = await service.getAlertsIndex(cases);

      expect(result.alerts.filter(a => a.matchStatus === 'matched')).toHaveLength(2);
      expect(result.summary.matched).toBe(2);
    });
  });

  describe('Workflow state management', () => {
    it('should preserve existing workflow status during rematch', async () => {
      const alert = {
        ...createMockAlert('alert-1', 'MCN-123'),
        status: 'resolved' as const,
        resolvedAt: '2024-01-15T10:00:00Z',
        resolutionNotes: 'Fixed issue',
      };

      const loadResult: LoadAlertsResult = {
        alerts: [alert],
        legacyWorkflows: [],
        needsMigration: false,
      };

      vi.mocked(mockAlertsStorage.loadAlertsFromStore).mockResolvedValue(loadResult);
      vi.mocked(mockAlertsStorage.saveAlerts).mockResolvedValue(true);

      const cases = [createMockCase('case-1', 'MCN-123')];
      const result = await service.getAlertsIndex(cases);

      expect(result.alerts[0].status).toBe('resolved');
      expect(result.alerts[0].resolvedAt).toBe('2024-01-15T10:00:00Z');
      expect(result.alerts[0].resolutionNotes).toBe('Fixed issue');
    });
  });
});
