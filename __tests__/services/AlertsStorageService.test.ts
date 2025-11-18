import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertsStorageService } from '@/utils/services/AlertsStorageService';
import type AutosaveFileService from '@/utils/AutosaveFileService';
import type { CaseDisplay } from '@/types/case';

// Mock the dependencies
vi.mock('@/utils/AutosaveFileService');
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  }),
}));
vi.mock('@/utils/fileStorageErrorReporter', () => ({
  reportFileStorageError: vi.fn(),
}));
vi.mock('@/utils/alerts/alertsCsvParser', () => ({
  parseAlertsFromCsv: vi.fn(),
}));

describe('AlertsStorageService', () => {
  let service: AlertsStorageService;
  let mockFileService: Partial<AutosaveFileService>;

  const mockCases: CaseDisplay[] = [
    {
      id: 'case-1',
      name: 'Test Case',
      mcn: 'MC001',
      status: 'open',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    } as unknown as CaseDisplay,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockFileService = {
      readNamedFile: vi.fn(),
      writeNamedFile: vi.fn(),
      readTextFile: vi.fn(),
    };

    service = new AlertsStorageService({
      fileService: mockFileService as AutosaveFileService,
    });
  });

  describe('loadAlertsFromStore', () => {
    it('should return empty result when file does not exist', async () => {
      vi.mocked(mockFileService.readNamedFile!).mockResolvedValue(null);

      const result = await service.loadAlertsFromStore();

      expect(result).toEqual({
        alerts: null,
        legacyWorkflows: [],
        needsMigration: false,
      });
    });

    it('should handle invalid JSON payload', async () => {
      vi.mocked(mockFileService.readNamedFile!).mockResolvedValue('invalid' as any);

      const result = await service.loadAlertsFromStore();

      expect(result.needsMigration).toBe(true);
      expect(result.error?.type).toBe('INVALID_JSON');
    });

    it('should load v2+ format alerts', async () => {
      const mockPayload = {
        version: 2,
        alerts: [
          {
            id: 'alert-1',
            reportId: 'RPT001',
            alertCode: 'AC001',
            alertType: 'Type1',
            alertDate: '2025-01-01',
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
            status: 'new',
            matchStatus: 'matched',
          },
        ],
        sourceFile: 'Alerts.csv',
      };

      vi.mocked(mockFileService.readNamedFile!).mockResolvedValue(mockPayload);

      const result = await service.loadAlertsFromStore();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts![0].id).toBe('alert-1');
      expect(result.needsMigration).toBe(false);
      expect(result.sourceFile).toBe('Alerts.csv');
    });

    it('should handle v1 legacy format', async () => {
      const mockPayload = {
        version: 1,
        alerts: [
          {
            alertId: 'alert-1',
            status: 'resolved',
            resolvedAt: '2025-01-15',
          },
        ],
      };

      vi.mocked(mockFileService.readNamedFile!).mockResolvedValue(mockPayload);

      const result = await service.loadAlertsFromStore();

      expect(result.alerts).toBeNull();
      expect(result.legacyWorkflows).toHaveLength(1);
      expect(result.legacyWorkflows[0].alertId).toBe('alert-1');
      expect(result.needsMigration).toBe(true);
    });

    it('should handle JSON syntax errors', async () => {
      vi.mocked(mockFileService.readNamedFile!).mockRejectedValue(
        new SyntaxError('Unexpected token')
      );

      const result = await service.loadAlertsFromStore();

      expect(result.error?.type).toBe('INVALID_JSON');
      expect(result.needsMigration).toBe(true);
    });

    it('should handle I/O errors', async () => {
      vi.mocked(mockFileService.readNamedFile!).mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.loadAlertsFromStore();

      expect(result.error?.type).toBe('IO_ERROR');
      expect(result.alerts).toBeNull();
    });

    it('should filter out invalid alert entries', async () => {
      const mockPayload = {
        version: 2,
        alerts: [
          {
            id: 'alert-1',
            reportId: 'RPT001',
            alertCode: 'AC001',
            alertType: 'Type1',
            alertDate: '2025-01-01',
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
            status: 'new',
            matchStatus: 'matched',
          },
          null, // Invalid entry
          { id: '' }, // Invalid: empty ID
          'invalid', // Invalid: not an object
        ],
      };

      vi.mocked(mockFileService.readNamedFile!).mockResolvedValue(mockPayload);

      const result = await service.loadAlertsFromStore();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts![0].id).toBe('alert-1');
    });
  });

  describe('saveAlerts', () => {
    it('should save alerts payload successfully', async () => {
      vi.mocked(mockFileService.writeNamedFile!).mockResolvedValue(true);

      const payload = {
        version: 2,
        generatedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        summary: {
          total: 1,
          matched: 1,
          unmatched: 0,
          missingMcn: 0,
        },
        alerts: [],
        uniqueAlerts: 0,
      };

      const result = await service.saveAlerts(payload);

      expect(result).toBe(true);
      expect(mockFileService.writeNamedFile).toHaveBeenCalledWith('alerts.json', payload);
    });

    it('should handle save failures', async () => {
      vi.mocked(mockFileService.writeNamedFile!).mockResolvedValue(false);

      const payload = {
        version: 2,
        generatedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        summary: {
          total: 0,
          matched: 0,
          unmatched: 0,
          missingMcn: 0,
        },
        alerts: [],
        uniqueAlerts: 0,
      };

      const result = await service.saveAlerts(payload);

      expect(result).toBe(false);
    });

    it('should handle save exceptions', async () => {
      vi.mocked(mockFileService.writeNamedFile!).mockRejectedValue(
        new Error('Write error')
      );

      const payload = {
        version: 2,
        generatedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        summary: {
          total: 0,
          matched: 0,
          unmatched: 0,
          missingMcn: 0,
        },
        alerts: [],
        uniqueAlerts: 0,
      };

      const result = await service.saveAlerts(payload);

      expect(result).toBe(false);
    });
  });

  describe('importAlertsFromCsv', () => {
    it('should import alerts from CSV file', async () => {
      const csvContent = 'reportId,alertCode,mcNumber\nRPT001,AC001,MC001';
      
      vi.mocked(mockFileService.readTextFile!).mockResolvedValue(csvContent);
      
      // Mock the parser
      const { parseAlertsFromCsv } = await import('@/utils/alerts/alertsCsvParser');
      vi.mocked(parseAlertsFromCsv).mockReturnValue({
        alerts: [
          {
            id: 'alert-1',
            reportId: 'RPT001',
            alertCode: 'AC001',
            alertType: '',
            alertDate: '',
            createdAt: '',
            updatedAt: '',
            status: 'new',
            matchStatus: 'matched',
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
      });

      const result = await service.importAlertsFromCsv(mockCases);

      expect(result.alerts).toHaveLength(1);
      expect(result.sourceFile).toBe('Alerts.csv');
      expect(result.error).toBeUndefined();
    });

    it('should handle missing CSV file', async () => {
      vi.mocked(mockFileService.readTextFile!).mockResolvedValue(null);

      const result = await service.importAlertsFromCsv(mockCases);

      expect(result.alerts).toHaveLength(0);
      expect(result.sourceFile).toBe('Alerts.csv');
    });

    it('should handle CSV parse errors', async () => {
      vi.mocked(mockFileService.readTextFile!).mockRejectedValue(
        new Error('Parse error')
      );

      const result = await service.importAlertsFromCsv(mockCases);

      expect(result.alerts).toHaveLength(0);
      expect(result.error?.type).toBe('PARSE_ERROR');
    });
  });
});
