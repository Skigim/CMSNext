/**
 * IndexedDB Handle Store
 * 
 * Provides IndexedDB-based persistence for File System Access API directory handles.
 * This enables resuming file access across browser sessions without re-prompting the user.
 * 
 * @module IndexedDBHandleStore
 */

// Default configuration values
const DEFAULT_DB_NAME = 'CaseTrackingFileAccess';
const DEFAULT_STORE_NAME = 'directoryHandles';
const DEFAULT_KEY = 'caseTrackingDirectory';

/**
 * Configuration options for the IndexedDB handle store.
 */
export interface IndexedDBHandleStoreConfig {
  /** Name of the IndexedDB database (default: 'CaseTrackingFileAccess') */
  dbName?: string;
  /** Name of the object store within the database (default: 'directoryHandles') */
  storeName?: string;
  /** Key used to store/retrieve the directory handle (default: 'caseTrackingDirectory') */
  dbKey?: string;
}

/**
 * Retrieves a stored directory handle from IndexedDB.
 * 
 * @param config - Optional configuration overrides
 * @returns The stored FileSystemDirectoryHandle, or null if not found
 * 
 * @example
 * ```typescript
 * const handle = await getStoredDirectoryHandle();
 * if (handle) {
 *   const permission = await handle.queryPermission({ mode: 'readwrite' });
 *   if (permission === 'granted') {
 *     // Use the handle
 *   }
 * }
 * ```
 */
export async function getStoredDirectoryHandle(
  config: IndexedDBHandleStoreConfig = {}
): Promise<FileSystemDirectoryHandle | null> {
  const {
    dbName = DEFAULT_DB_NAME,
    storeName = DEFAULT_STORE_NAME,
    dbKey = DEFAULT_KEY,
  } = config;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve(null);
        return;
      }
      const getRequest = db
        .transaction(storeName)
        .objectStore(storeName)
        .get(dbKey);
      getRequest.onsuccess = () => {
        db.close();
        resolve(getRequest.result?.handle || null);
      };
      getRequest.onerror = () => {
        db.close();
        resolve(null);
      };
    };
    
    request.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(storeName);
    };
  });
}

/**
 * Stores a directory handle in IndexedDB for persistence across sessions.
 * 
 * @param handle - The FileSystemDirectoryHandle to store
 * @param config - Optional configuration overrides
 * @returns Promise that resolves when the handle is stored
 * 
 * @example
 * ```typescript
 * const handle = await window.showDirectoryPicker();
 * await storeDirectoryHandle(handle);
 * ```
 */
export async function storeDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  config: IndexedDBHandleStoreConfig = {}
): Promise<void> {
  const {
    dbName = DEFAULT_DB_NAME,
    storeName = DEFAULT_STORE_NAME,
    dbKey = DEFAULT_KEY,
  } = config;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    
    request.onerror = (e) => reject(e);
    
    request.onsuccess = () => {
      const db = request.result;
      const putRequest = db
        .transaction(storeName, 'readwrite')
        .objectStore(storeName)
        .put({ handle }, dbKey);
      putRequest.onsuccess = () => {
        db.close();
        resolve();
      };
      putRequest.onerror = (e) => {
        db.close();
        reject(e);
      };
    };
    
    request.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(storeName);
    };
  });
}

/**
 * Clears the stored directory handle from IndexedDB.
 * 
 * @param config - Optional configuration overrides
 * @returns Promise that resolves when the handle is cleared
 * 
 * @example
 * ```typescript
 * await clearStoredDirectoryHandle();
 * ```
 */
export async function clearStoredDirectoryHandle(
  config: IndexedDBHandleStoreConfig = {}
): Promise<void> {
  const {
    dbName = DEFAULT_DB_NAME,
    storeName = DEFAULT_STORE_NAME,
    dbKey = DEFAULT_KEY,
  } = config;

  return new Promise((resolve) => {
    const request = indexedDB.open(dbName, 1);
    
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve();
        return;
      }
      const deleteRequest = db
        .transaction(storeName, 'readwrite')
        .objectStore(storeName)
        .delete(dbKey);
      deleteRequest.onsuccess = () => {
        db.close();
        resolve();
      };
      deleteRequest.onerror = () => {
        db.close();
        resolve();
      };
    };
    
    request.onerror = () => resolve();
    
    request.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(storeName);
    };
  });
}

/**
 * Checks if a stored handle exists and has valid permissions.
 * 
 * @param config - Optional configuration overrides
 * @returns Promise resolving to true if a valid handle exists with granted permissions
 * 
 * @example
 * ```typescript
 * const hasValidHandle = await hasStoredHandleWithPermission();
 * if (hasValidHandle) {
 *   // Can restore previous session
 * }
 * ```
 */
export async function hasStoredHandleWithPermission(
  config: IndexedDBHandleStoreConfig = {}
): Promise<boolean> {
  try {
    const handle = await getStoredDirectoryHandle(config);
    if (!handle) return false;
    
    const permission = await (handle as any).queryPermission({ mode: 'readwrite' });
    return permission === 'granted';
  } catch {
    return false;
  }
}
