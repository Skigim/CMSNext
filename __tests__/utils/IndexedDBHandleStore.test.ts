/**
 * Tests for IndexedDBHandleStore module
 * 
 * Tests the IndexedDB-based persistence for File System Access API directory handles.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getStoredDirectoryHandle,
  storeDirectoryHandle,
  clearStoredDirectoryHandle,
  hasStoredHandleWithPermission,
} from '@/utils/IndexedDBHandleStore';

// Mock directory handle
const createMockDirectoryHandle = (name = 'test-directory') => ({
  name,
  kind: 'directory' as const,
  queryPermission: vi.fn().mockResolvedValue('granted'),
  requestPermission: vi.fn().mockResolvedValue('granted'),
});

// Helper to create a mock IndexedDB
function createMockIndexedDB() {
  let storedData: Record<string, any> = {};
  const objectStoreNames = new Set<string>();

  const createMockObjectStore = (storeName: string) => ({
    get: vi.fn((key: string) => {
      const request = {
        result: storedData[`${storeName}:${key}`] || null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    }),
    put: vi.fn((value: any, key: string) => {
      storedData[`${storeName}:${key}`] = value;
      const request = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    }),
    delete: vi.fn((key: string) => {
      delete storedData[`${storeName}:${key}`];
      const request = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    }),
  });

  const createMockTransaction = (storeName: string, _mode?: IDBTransactionMode) => ({
    objectStore: vi.fn(() => createMockObjectStore(storeName)),
  });

  const createMockDB = () => ({
    objectStoreNames: {
      contains: (name: string) => objectStoreNames.has(name),
    },
    createObjectStore: (name: string) => {
      objectStoreNames.add(name);
      return createMockObjectStore(name);
    },
    transaction: createMockTransaction,
    close: vi.fn(),
  });

  return {
    open: vi.fn((_dbName: string, _version?: number) => {
      const db = createMockDB();
      const request = {
        result: db,
        error: null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as ((e: { target: { result: any } }) => void) | null,
      };

      setTimeout(() => {
        // Simulate upgrade if store doesn't exist
        if (!objectStoreNames.has('directoryHandles')) {
          request.onupgradeneeded?.({ target: { result: db } });
        }
        request.onsuccess?.();
      }, 0);

      return request;
    }),
    _reset: () => {
      storedData = {};
      objectStoreNames.clear();
    },
    _setStoredData: (storeName: string, key: string, value: any) => {
      objectStoreNames.add(storeName);
      storedData[`${storeName}:${key}`] = value;
    },
  };
}

describe('IndexedDBHandleStore', () => {
  let mockIndexedDB: ReturnType<typeof createMockIndexedDB>;

  beforeEach(() => {
    mockIndexedDB = createMockIndexedDB();
    Object.defineProperty(global, 'indexedDB', {
      value: mockIndexedDB,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockIndexedDB._reset();
  });

  describe('getStoredDirectoryHandle', () => {
    it('returns null when no handle is stored', async () => {
      const result = await getStoredDirectoryHandle();
      expect(result).toBeNull();
    });

    it('returns stored handle when available', async () => {
      const mockHandle = createMockDirectoryHandle();
      mockIndexedDB._setStoredData(
        'directoryHandles',
        'caseTrackingDirectory',
        { handle: mockHandle }
      );

      const result = await getStoredDirectoryHandle();
      expect(result).toBe(mockHandle);
    });

    it('uses custom config when provided', async () => {
      const mockHandle = createMockDirectoryHandle('custom-dir');
      mockIndexedDB._setStoredData('customStore', 'customKey', { handle: mockHandle });

      const result = await getStoredDirectoryHandle({
        dbName: 'CustomDB',
        storeName: 'customStore',
        dbKey: 'customKey',
      });

      expect(result).toBe(mockHandle);
    });
  });

  describe('storeDirectoryHandle', () => {
    it('stores a directory handle', async () => {
      const mockHandle = createMockDirectoryHandle();

      await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle);

      // Verify IndexedDB.open was called
      expect(mockIndexedDB.open).toHaveBeenCalledWith('CaseTrackingFileAccess', 1);
    });

    it('uses custom config when provided', async () => {
      const mockHandle = createMockDirectoryHandle();

      await storeDirectoryHandle(mockHandle as unknown as FileSystemDirectoryHandle, {
        dbName: 'CustomDB',
        storeName: 'customStore',
        dbKey: 'customKey',
      });

      expect(mockIndexedDB.open).toHaveBeenCalledWith('CustomDB', 1);
    });
  });

  describe('clearStoredDirectoryHandle', () => {
    it('clears stored handle', async () => {
      const mockHandle = createMockDirectoryHandle();
      mockIndexedDB._setStoredData(
        'directoryHandles',
        'caseTrackingDirectory',
        { handle: mockHandle }
      );

      await clearStoredDirectoryHandle();

      // Verify IndexedDB.open was called
      expect(mockIndexedDB.open).toHaveBeenCalledWith('CaseTrackingFileAccess', 1);
    });

    it('handles case when store does not exist', async () => {
      // No stored data, store doesn't exist
      await expect(clearStoredDirectoryHandle()).resolves.toBeUndefined();
    });
  });

  describe('hasStoredHandleWithPermission', () => {
    it('returns false when no handle is stored', async () => {
      const result = await hasStoredHandleWithPermission();
      expect(result).toBe(false);
    });

    it('returns true when handle has granted permission', async () => {
      const mockHandle = createMockDirectoryHandle();
      mockHandle.queryPermission.mockResolvedValue('granted');
      mockIndexedDB._setStoredData(
        'directoryHandles',
        'caseTrackingDirectory',
        { handle: mockHandle }
      );

      const result = await hasStoredHandleWithPermission();
      expect(result).toBe(true);
    });

    it('returns false when handle permission is denied', async () => {
      const mockHandle = createMockDirectoryHandle();
      mockHandle.queryPermission.mockResolvedValue('denied');
      mockIndexedDB._setStoredData(
        'directoryHandles',
        'caseTrackingDirectory',
        { handle: mockHandle }
      );

      const result = await hasStoredHandleWithPermission();
      expect(result).toBe(false);
    });

    it('returns false when permission check throws', async () => {
      const mockHandle = createMockDirectoryHandle();
      mockHandle.queryPermission.mockRejectedValue(new Error('Permission error'));
      mockIndexedDB._setStoredData(
        'directoryHandles',
        'caseTrackingDirectory',
        { handle: mockHandle }
      );

      const result = await hasStoredHandleWithPermission();
      expect(result).toBe(false);
    });
  });
});
