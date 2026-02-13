/**
 * @fileoverview Tests for ActivityLogService
 *
 * Covers auto-archive and archiveOldEntries logic.
 */

import { describe, it, expect, vi } from 'vitest';
import { ActivityLogService, DEFAULT_ACTIVITY_RETENTION_DAYS } from '@/utils/services/ActivityLogService';
import type { CaseActivityEntry } from '@/types/activityLog';
import type { FileStorageService, NormalizedFileData } from '@/utils/services/FileStorageService';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<CaseActivityEntry> & { timestamp: string }): CaseActivityEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2, 8)}`,
    caseId: 'case-1',
    caseName: 'Test Case',
    caseMcn: 'MCN-1',
    type: 'note-added',
    payload: { noteId: 'n1', category: 'General', preview: 'test' },
    ...overrides,
  } as CaseActivityEntry;
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function createMockFileStorage(activityLog: CaseActivityEntry[] = []): FileStorageService {
  let storedData = {
    cases: [],
    financials: [],
    notes: [],
    alerts: [],
    categoryConfig: { statuses: [], noteCategories: [] },
    activityLog,
    version: '2.0',
    exported_at: new Date().toISOString(),
    total_cases: 0,
  } as unknown as NormalizedFileData;

  return {
    readFileData: vi.fn(async () => storedData),
    writeNormalizedData: vi.fn(async (data: NormalizedFileData) => {
      storedData = data;
    }),
  } as unknown as FileStorageService;
}

function createMockFileService() {
  const files = new Map<string, unknown>();
  return {
    readNamedFile: vi.fn(async (fileName: string) => files.get(fileName) ?? null),
    writeNamedFile: vi.fn(async (fileName: string, data: unknown) => {
      files.set(fileName, data);
      return true;
    }),
    _files: files,
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('ActivityLogService', () => {
  describe('archiveOldEntries', () => {
    it('should split entries at cutoff date', async () => {
      const entries = [
        makeEntry({ id: 'recent', timestamp: daysAgo(5) }),
        makeEntry({ id: 'old', timestamp: daysAgo(100) }),
      ];
      const fileStorage = createMockFileStorage(entries);
      const service = new ActivityLogService({ fileStorage });

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const result = await service.archiveOldEntries(cutoff);

      expect(result.recentEntries).toHaveLength(1);
      expect(result.recentEntries[0].id).toBe('recent');
      expect(result.archivedEntries).toHaveLength(1);
      expect(result.archivedEntries[0].id).toBe('old');
      expect(result.archivedCount).toBe(1);
    });

    it('should return unchanged when no old entries', async () => {
      const entries = [
        makeEntry({ id: 'recent1', timestamp: daysAgo(1) }),
        makeEntry({ id: 'recent2', timestamp: daysAgo(5) }),
      ];
      const fileStorage = createMockFileStorage(entries);
      const service = new ActivityLogService({ fileStorage });

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const result = await service.archiveOldEntries(cutoff);

      expect(result.archivedCount).toBe(0);
      expect(result.recentEntries).toHaveLength(2);
    });

    it('should handle entries with invalid timestamps', async () => {
      const entries = [
        makeEntry({ id: 'bad-ts', timestamp: 'not-a-date' }),
        makeEntry({ id: 'old', timestamp: daysAgo(200) }),
        makeEntry({ id: 'recent', timestamp: daysAgo(5) }),
      ];
      const fileStorage = createMockFileStorage(entries);
      const service = new ActivityLogService({ fileStorage });

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const result = await service.archiveOldEntries(cutoff);

      // NaN comparison => false for >= cutoffTime, so invalid goes to archived
      // Unless try/catch catches a real error, in which case it stays in recent
      expect(result.recentEntries.map(e => e.id)).toContain('recent');
      expect(result.archivedEntries.map(e => e.id)).toContain('old');
      // Total should equal original count
      expect(result.recentEntries.length + result.archivedEntries.length).toBe(entries.length);
    });

    it('should write only recent entries back to file', async () => {
      const entries = [
        makeEntry({ id: 'keep', timestamp: daysAgo(5) }),
        makeEntry({ id: 'archive', timestamp: daysAgo(100) }),
      ];
      const fileStorage = createMockFileStorage(entries);
      const service = new ActivityLogService({ fileStorage });

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      await service.archiveOldEntries(cutoff);

      expect(fileStorage.writeNormalizedData).toHaveBeenCalled();
      const writtenData = (fileStorage.writeNormalizedData as ReturnType<typeof vi.fn>).mock.calls[0][0] as NormalizedFileData;
      expect(writtenData.activityLog).toHaveLength(1);
      expect(writtenData.activityLog[0].id).toBe('keep');
    });
  });

  describe('autoArchive', () => {
    it('should return early when no fileService is configured', async () => {
      const fileStorage = createMockFileStorage([]);
      const service = new ActivityLogService({ fileStorage });

      const result = await service.autoArchive();

      expect(result.archivedCount).toBe(0);
      expect(result.archiveFileNames).toEqual([]);
    });

    it('should archive old entries and write archive file', async () => {
      const entries = [
        makeEntry({ id: 'recent', timestamp: daysAgo(10) }),
        makeEntry({ id: 'old1', timestamp: daysAgo(DEFAULT_ACTIVITY_RETENTION_DAYS + 10) }),
        makeEntry({ id: 'old2', timestamp: daysAgo(DEFAULT_ACTIVITY_RETENTION_DAYS + 20) }),
      ];
      const fileStorage = createMockFileStorage(entries);
      const fileService = createMockFileService();
      const service = new ActivityLogService({
        fileStorage,
        fileService: fileService as any,
      });

      const result = await service.autoArchive();

      expect(result.archivedCount).toBe(2);
      expect(result.retainedCount).toBe(1);
      expect(result.archiveFileNames).toHaveLength(1);
      expect(result.archiveFileNames[0]).toMatch(/^activityLog-archive-\d{4}\.json$/);

      // Verify archive file was written
      expect(fileService.writeNamedFile).toHaveBeenCalled();
      const writtenFileName = fileService.writeNamedFile.mock.calls[0][0];
      const writtenPayload = fileService.writeNamedFile.mock.calls[0][1] as {
        type: string;
        entries: CaseActivityEntry[];
        entryCount: number;
      };
      expect(writtenPayload.type).toBe('activityLog-archive');
      expect(writtenPayload.entries).toHaveLength(2);
      expect(writtenPayload.entryCount).toBe(2);
      expect(writtenFileName).toBe(result.archiveFileNames[0]);
    });

    it('should merge with existing archive file', async () => {
      // Both entries will land in the same year bucket
      const oldTimestamp = daysAgo(DEFAULT_ACTIVITY_RETENTION_DAYS + 5);
      const prevTimestamp = daysAgo(DEFAULT_ACTIVITY_RETENTION_DAYS + 50);
      const targetYear = new Date(oldTimestamp).getFullYear();

      const existingArchive = {
        type: 'activityLog-archive',
        year: targetYear,
        entryCount: 1,
        archivedAt: new Date().toISOString(),
        entries: [
          makeEntry({ id: 'prev-archived', timestamp: prevTimestamp }),
        ],
      };

      const entries = [
        makeEntry({ id: 'recent', timestamp: daysAgo(5) }),
        makeEntry({ id: 'old-new', timestamp: oldTimestamp }),
      ];
      const fileStorage = createMockFileStorage(entries);
      const fileService = createMockFileService();
      fileService._files.set(`activityLog-archive-${targetYear}.json`, existingArchive);

      const service = new ActivityLogService({
        fileStorage,
        fileService: fileService as any,
      });

      const result = await service.autoArchive();

      expect(result.archivedCount).toBe(1);

      const writtenPayload = fileService.writeNamedFile.mock.calls[0][1] as {
        entries: CaseActivityEntry[];
        entryCount: number;
      };
      // Should have both the existing + new archived entry
      expect(writtenPayload.entries).toHaveLength(2);
      expect(writtenPayload.entries.map((e: CaseActivityEntry) => e.id)).toContain('prev-archived');
      expect(writtenPayload.entries.map((e: CaseActivityEntry) => e.id)).toContain('old-new');
    });

    it('should deduplicate entries by ID on merge', async () => {
      const dupTimestamp = daysAgo(DEFAULT_ACTIVITY_RETENTION_DAYS + 10);
      const targetYear = new Date(dupTimestamp).getFullYear();
      const sharedEntry = makeEntry({ id: 'dup', timestamp: dupTimestamp });
      const existingArchive = {
        type: 'activityLog-archive',
        year: targetYear,
        entryCount: 1,
        archivedAt: new Date().toISOString(),
        entries: [sharedEntry],
      };

      const entries = [
        makeEntry({ id: 'recent', timestamp: daysAgo(5) }),
        { ...sharedEntry }, // Duplicate entry
      ];
      const fileStorage = createMockFileStorage(entries);
      const fileService = createMockFileService();
      fileService._files.set(`activityLog-archive-${targetYear}.json`, existingArchive);

      const service = new ActivityLogService({
        fileStorage,
        fileService: fileService as any,
      });

      await service.autoArchive();

      const writtenPayload = fileService.writeNamedFile.mock.calls[0][1] as {
        entries: CaseActivityEntry[];
      };
      expect(writtenPayload.entries).toHaveLength(1);
      expect(writtenPayload.entries[0].id).toBe('dup');
    });

    it('should not write when nothing to archive', async () => {
      const entries = [
        makeEntry({ id: 'recent', timestamp: daysAgo(5) }),
      ];
      const fileStorage = createMockFileStorage(entries);
      const fileService = createMockFileService();
      const service = new ActivityLogService({
        fileStorage,
        fileService: fileService as any,
      });

      const result = await service.autoArchive();

      expect(result.archivedCount).toBe(0);
      expect(result.archiveFileNames).toEqual([]);
      expect(fileService.writeNamedFile).not.toHaveBeenCalled();
    });

    it('should accept custom retention days', async () => {
      const entries = [
        makeEntry({ id: 'recent', timestamp: daysAgo(5) }),
        makeEntry({ id: 'medium', timestamp: daysAgo(15) }),
        makeEntry({ id: 'old', timestamp: daysAgo(40) }),
      ];
      const fileStorage = createMockFileStorage(entries);
      const fileService = createMockFileService();
      const service = new ActivityLogService({
        fileStorage,
        fileService: fileService as any,
      });

      const result = await service.autoArchive(10);

      // retentionDays=10 means entries older than 10 days get archived
      expect(result.archivedCount).toBe(2);
      expect(result.retainedCount).toBe(1);
    });

    it.each([0, -1, Number.NaN, Infinity, -Infinity])('should reject invalid retentionDays: %s', async (days) => {
      const fileStorage = createMockFileStorage([]);
      const fileService = createMockFileService();
      const service = new ActivityLogService({
        fileStorage,
        fileService: fileService as any,
      });

      await expect(service.autoArchive(days)).rejects.toThrow(/Invalid retentionDays/);
    });

    it('should propagate writeNamedFile failure without losing main file data', async () => {
      const entries = [
        makeEntry({ id: 'recent', timestamp: daysAgo(5) }),
        makeEntry({ id: 'old', timestamp: daysAgo(DEFAULT_ACTIVITY_RETENTION_DAYS + 10) }),
      ];
      const fileStorage = createMockFileStorage(entries);
      const fileService = createMockFileService();
      fileService.writeNamedFile.mockRejectedValueOnce(new Error('Disk full'));

      const service = new ActivityLogService({
        fileStorage,
        fileService: fileService as any,
      });

      // autoArchive should propagate the write error
      await expect(service.autoArchive()).rejects.toThrow('Disk full');

      // archiveOldEntries already wrote recent entries to the main file,
      // so the main file should still contain the recent entry
      const mainData = await fileStorage.readFileData();
      expect(mainData?.activityLog).toHaveLength(1);
      expect(mainData?.activityLog[0].id).toBe('recent');
    });

    it('should handle entries spanning multiple years', async () => {
      const entries = [
        makeEntry({ id: 'recent', timestamp: daysAgo(5) }),
        makeEntry({ id: 'old-2024', timestamp: '2024-03-15T12:00:00.000Z' }),
        makeEntry({ id: 'old-2023', timestamp: '2023-06-01T12:00:00.000Z' }),
      ];
      const fileStorage = createMockFileStorage(entries);
      const fileService = createMockFileService();
      const service = new ActivityLogService({
        fileStorage,
        fileService: fileService as any,
      });

      const result = await service.autoArchive();

      expect(result.archivedCount).toBe(2);
      expect(result.retainedCount).toBe(1);

      // Should have written two separate archive files
      expect(result.archiveFileNames).toHaveLength(2);
      expect(result.archiveFileNames).toContain('activityLog-archive-2024.json');
      expect(result.archiveFileNames).toContain('activityLog-archive-2023.json');
      expect(fileService.writeNamedFile).toHaveBeenCalledTimes(2);

      const writtenFileNames = fileService.writeNamedFile.mock.calls.map(
        (call: [string, unknown]) => call[0]
      );
      expect(writtenFileNames).toContain('activityLog-archive-2024.json');
      expect(writtenFileNames).toContain('activityLog-archive-2023.json');

      // Verify each file has the correct entry
      const payload2024 = fileService.writeNamedFile.mock.calls.find(
        (call: [string, unknown]) => call[0] === 'activityLog-archive-2024.json'
      )![1] as { entries: CaseActivityEntry[] };
      expect(payload2024.entries).toHaveLength(1);
      expect(payload2024.entries[0].id).toBe('old-2024');

      const payload2023 = fileService.writeNamedFile.mock.calls.find(
        (call: [string, unknown]) => call[0] === 'activityLog-archive-2023.json'
      )![1] as { entries: CaseActivityEntry[] };
      expect(payload2023.entries).toHaveLength(1);
      expect(payload2023.entries[0].id).toBe('old-2023');
    });

    it('should serialize concurrent autoArchive calls', async () => {
      const entries = [
        makeEntry({ id: 'recent', timestamp: daysAgo(5) }),
        makeEntry({ id: 'old', timestamp: daysAgo(DEFAULT_ACTIVITY_RETENTION_DAYS + 10) }),
      ];
      const fileStorage = createMockFileStorage(entries);
      const fileService = createMockFileService();
      const service = new ActivityLogService({
        fileStorage,
        fileService: fileService as any,
      });

      // Fire two concurrent calls
      const [result1, result2] = await Promise.all([
        service.autoArchive(),
        service.autoArchive(),
      ]);

      // Both should get the same result (second piggybacks on first)
      expect(result1).toEqual(result2);
      // writeNamedFile should only be called once (not twice)
      expect(fileService.writeNamedFile).toHaveBeenCalledTimes(1);
    });
  });
});
