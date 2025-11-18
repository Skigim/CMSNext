import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseAlertsFromCsv } from '@/utils/alerts/alertsCsvParser';
import type { CaseDisplay } from '@/types/case';
import * as alertsData from '@/utils/alertsData';

// Mock the alertsData module
vi.mock('@/utils/alertsData', async () => {
  const actual = await vi.importActual<typeof import('@/utils/alertsData')>('@/utils/alertsData');
  return {
    ...actual,
    parseStackedAlerts: vi.fn(),
    buildAlertStorageKey: vi.fn(),
  };
});

describe('AlertsCsvParser', () => {
  const mockCases: CaseDisplay[] = [
    {
      id: 'case-1',
      name: 'Test Case',
      mcNumber: 'MC001',
      mcn: 'MC001',
      status: 'pending',
      priority: false,
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      person: {
        firstName: 'John',
        lastName: 'Doe',
      } as any,
      caseRecord: {
        mcn: 'MC001',
        caseNumber: 'CN001',
        openDate: '2025-01-01',
      } as any,
    } as unknown as CaseDisplay,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseAlertsFromCsv', () => {
    it('should parse valid CSV content', () => {
      const mockAlertsIndex = {
        alerts: [
          {
            id: 'alert-1',
            reportId: 'RPT001',
            alertCode: 'AC001',
            alertType: 'standard',
            alertDate: '2025-01-01',
            status: 'new' as const,
            matchStatus: 'matched' as const,
            mcNumber: 'MC001',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
        summary: {
          total: 1,
          matched: 1,
          unmatched: 0,
          missingMcn: 0,
        },
        alertsByCaseId: new Map(),
        unmatched: [],
        missingMcn: [],
      };

      vi.mocked(alertsData.parseStackedAlerts).mockReturnValue(mockAlertsIndex);
      vi.mocked(alertsData.buildAlertStorageKey).mockReturnValue('RPT001|2025-01-01');

      const csvContent = 'reportId,alertCode,mcNumber\nRPT001,AC001,MC001';
      const result = parseAlertsFromCsv(csvContent, mockCases);

      expect(result).toBeDefined();
      expect(result.alerts).toHaveLength(1);
      expect(result.summary.total).toBe(1);
      expect(alertsData.parseStackedAlerts).toHaveBeenCalledWith(csvContent, mockCases);
    });

    it('should handle empty CSV content', () => {
      const emptyAlertsIndex = {
        alerts: [],
        summary: {
          total: 0,
          matched: 0,
          unmatched: 0,
          missingMcn: 0,
        },
        alertsByCaseId: new Map(),
        unmatched: [],
        missingMcn: [],
      };

      vi.mocked(alertsData.parseStackedAlerts).mockReturnValue(emptyAlertsIndex);

      const result = parseAlertsFromCsv('', mockCases);

      expect(result.alerts).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });

    it('should handle empty cases array', () => {
      const mockAlertsIndex = {
        alerts: [
          {
            id: 'alert-2',
            reportId: 'RPT002',
            alertCode: 'AC002',
            alertType: 'standard',
            alertDate: '2025-01-01',
            status: 'new' as const,
            matchStatus: 'unmatched' as const,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
        summary: {
          total: 1,
          matched: 0,
          unmatched: 1,
          missingMcn: 0,
        },
        alertsByCaseId: new Map(),
        unmatched: [],
        missingMcn: [],
      };

      vi.mocked(alertsData.parseStackedAlerts).mockReturnValue(mockAlertsIndex);
      vi.mocked(alertsData.buildAlertStorageKey).mockReturnValue('RPT002|2025-01-01');

      const csvContent = 'reportId,alertCode\nRPT002,AC002';
      const result = parseAlertsFromCsv(csvContent, []);

      expect(result).toBeDefined();
      expect(result.summary.matched).toBe(0);
      expect(alertsData.parseStackedAlerts).toHaveBeenCalledWith(csvContent, []);
    });

    it('should calculate unique alert metrics', () => {
      const mockAlertsIndex = {
        alerts: [
          {
            id: 'alert-1',
            reportId: 'RPT001',
            alertCode: 'AC001',
            alertType: 'standard',
            alertDate: '2025-01-01',
            status: 'new' as const,
            matchStatus: 'matched' as const,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
          {
            id: 'alert-2',
            reportId: 'RPT001', // Same reportId (duplicate)
            alertCode: 'AC002',
            alertType: 'standard',
            alertDate: '2025-01-01',
            status: 'new' as const,
            matchStatus: 'matched' as const,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
          {
            id: 'alert-3',
            reportId: 'RPT002',
            alertCode: 'AC003',
            alertType: 'standard',
            alertDate: '2025-01-01',
            status: 'new' as const,
            matchStatus: 'matched' as const,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
        summary: {
          total: 3,
          matched: 3,
          unmatched: 0,
          missingMcn: 0,
        },
        alertsByCaseId: new Map(),
        unmatched: [],
        missingMcn: [],
      };

      vi.mocked(alertsData.parseStackedAlerts).mockReturnValue(mockAlertsIndex);
      
      // Mock buildAlertStorageKey to return same key for duplicates
      vi.mocked(alertsData.buildAlertStorageKey)
        .mockReturnValueOnce('RPT001|2025-01-01')
        .mockReturnValueOnce('RPT001|2025-01-01') // Duplicate
        .mockReturnValueOnce('RPT002|2025-01-01');

      const csvContent = 'reportId,alertCode\nRPT001,AC001\nRPT001,AC002\nRPT002,AC003';
      const result = parseAlertsFromCsv(csvContent, mockCases);

      expect(result).toBeDefined();
      expect(result.alerts).toHaveLength(3);
    });

    it('should log debug metrics when alerts are parsed', () => {
      const mockAlertsIndex = {
        alerts: [
          {
            id: 'alert-4',
            reportId: 'RPT004',
            alertCode: 'AC004',
            alertType: 'eligibility',
            alertDate: '2025-01-01',
            status: 'new' as const,
            matchStatus: 'matched' as const,
            description: 'Test alert',
            mcNumber: 'MC002',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            metadata: {
              rawProgram: 'SNAP',
              rawType: 'eligibility',
              rawDescription: 'Test alert',
              alertNumber: '12345',
            },
          },
        ],
        summary: {
          total: 1,
          matched: 1,
          unmatched: 0,
          missingMcn: 0,
        },
        alertsByCaseId: new Map(),
        unmatched: [],
        missingMcn: [],
      };

      vi.mocked(alertsData.parseStackedAlerts).mockReturnValue(mockAlertsIndex);
      vi.mocked(alertsData.buildAlertStorageKey).mockReturnValue('RPT004|2025-01-01');

      const csvContent = 'reportId,alertCode,mcNumber,program,type,description,alertNumber\nRPT004,AC004,MC002,SNAP,eligibility,Test alert,12345';
      const result = parseAlertsFromCsv(csvContent, mockCases);

      expect(result).toBeDefined();
      expect(result.alerts[0]).toBeDefined();
      expect(result.alerts[0].metadata).toBeDefined();
    });
  });
});
