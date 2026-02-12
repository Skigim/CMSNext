/// <reference path="../types/global.d.ts" />

import { createLogger } from "./logger";
import { createLocalStorageAdapter } from "./localStorage";
import {
  getStoredDirectoryHandle,
  storeDirectoryHandle,
  clearStoredDirectoryHandle,
  type IndexedDBHandleStoreConfig,
} from "./IndexedDBHandleStore";
import { isEncryptedPayload } from "@/types/encryption";

const logger = createLogger("AutosaveFileService");

// Storage adapter for last save timestamp (used for multi-tab coordination)
const lastSaveStorage = createLocalStorageAdapter<{ timestamp: number; tabId: string } | null>(
  "cmsnext-last-save",
  null
);

/**
 * Case Tracking Platform Combined Autosave & File Service v1.0
 *
 * Combines file system operations with autosave functionality to eliminate
 * service coordination complexity and timing issues.
 *
 * Features:
 * - File System Access API with IndexedDB persistence
 * - Intelligent autosave with permission awareness
 * - Single service initialization (no dependency injection)
 * - Graceful degradation when permissions unavailable
 * - Multi-tab coordination and conflict resolution
 *
 * @version 1.0.0
 * @author Case Tracking Platform Team
 */

// Removed devConfig import - debug logging is no longer conditional

/**
 * Options for configuring error callbacks.
 * @interface ErrorCallbackOptions
 */
interface ErrorCallbackOptions {
  /** Human-readable error message */
  message: string;
  /** Type of error ('error', 'warning', 'info') */
  type?: string;
  /** The underlying error object, if available */
  error?: unknown;
  /** Additional context about the operation that failed */
  context?: Record<string, unknown>;
}

/**
 * Configuration options for AutosaveFileService initialization.
 * @interface AutosaveConfig
 */
interface AutosaveConfig {
  /** Name of the JSON file to store data (default: 'case-tracker-data.json') */
  fileName?: string;
  /** Callback function for error notifications */
  errorCallback?: (options: ErrorCallbackOptions) => void;
  /** Optional sanitization function for strings (deprecated) */
  sanitizeFn?: (str: string) => string;
  /** Unique identifier for this browser tab */
  tabId?: string;
  /** Whether autosave is enabled (default: true) */
  enabled?: boolean;
  /** Interval between periodic saves in milliseconds (default: 120000 = 2 minutes) */
  saveInterval?: number;
  /** Debounce delay after data changes in milliseconds (default: 5000 = 5 seconds) */
  debounceDelay?: number;
  /** Maximum number of save retries on failure (default: 3) */
  maxRetries?: number;
  /** Callback function for status updates */
  statusCallback?: (status: StatusUpdate) => void;
}

/**
 * Status update information provided to status callbacks.
 * @interface StatusUpdate
 */
interface StatusUpdate {
  /** Current status ('running', 'saving', 'error', 'waiting', etc.) */
  status: string;
  /** Human-readable status message */
  message: string;
  /** Timestamp of this status update */
  timestamp: number;
  /** Current file system permission status */
  permissionStatus: string;
  /** Timestamp of last successful save, or null if never saved */
  lastSaveTime: number | null;
  /** Number of consecutive save failures */
  consecutiveFailures: number;
  /** Number of pending write operations */
  pendingWrites: number;
}

/**
 * Internal service state tracking.
 * @private
 * @interface ServiceState
 */
interface ServiceState {
  /** Whether the autosave service is actively running */
  isRunning: boolean;
  /** Current file system permission status */
  permissionStatus: string;
  /** Timestamp of last successful save */
  lastSaveTime: number | null;
  /** Timestamp of last data change notification */
  lastDataChange: number | null;
  /** Number of consecutive save failures */
  consecutiveFailures: number;
  /** Whether a save operation is currently pending */
  pendingSave: boolean;
}

/**
 * Timer references for cleanup.
 * @private
 * @interface Timers
 */
interface Timers {
  /** Interval timer for periodic saves */
  saveInterval: NodeJS.Timeout | null;
  /** Timeout for debounced saves after data changes */
  debounceTimeout: NodeJS.Timeout | null;
  /** Interval timer for permission checks */
  permissionCheck: NodeJS.Timeout | null;
}

/**
 * A queued write operation waiting to be processed.
 * @private
 * @interface WriteQueueItem
 */
interface WriteQueueItem {
  /** The data to write */
  data: any;
  /** Promise resolve function for operation completion */
  resolve: (value: boolean) => void;
  /** Promise reject function for operation failure */
  reject: (reason: any) => void;
}

/**
 * Encryption hooks for data at rest encryption.
 * 
 * These hooks are called during read/write operations to encrypt/decrypt
 * data transparently. If not provided, data is stored in plain JSON.
 * 
 * @interface EncryptionHooks
 */
interface EncryptionHooks {
  /** Encrypt data before writing to file */
  encrypt: (data: any) => Promise<any>;
  /** Decrypt data after reading from file */
  decrypt: (data: any) => Promise<any>;
  /** Check if data is encrypted */
  isEncrypted: (data: any) => boolean;
}

/**
 * AutosaveFileService - Combined File System Access and Autosave Service
 * 
 * This service combines file system operations with automatic save functionality
 * to provide a complete local-first data persistence solution. It uses the
 * File System Access API with IndexedDB for handle persistence.
 * 
 * ## Core Features
 * 
 * ### File System Operations
 * - **Directory Access**: Uses File System Access API for local file operations
 * - **Permission Management**: Handles permission requests and restoration
 * - **Handle Persistence**: Stores directory handles in IndexedDB across sessions
 * - **Multi-file Support**: Can read/write multiple files in the same directory
 * 
 * ### Autosave Functionality
 * - **Intelligent Timing**: Combines periodic saves with debounced change detection
 * - **Bulk Operation Detection**: Uses longer delays during rapid changes
 * - **Write Queue**: Prevents race conditions with serialized writes
 * - **Retry Logic**: Automatically retries failed writes with exponential backoff
 * - **State Conflict Resolution**: Refreshes handles to resolve cached state issues
 * 
 * ### Data Security
 * - **Optional Encryption**: Supports transparent encryption via hooks
 * - **Local-First**: All data stays on the user's device
 * - **No Network**: Never sends data over the network
 * 
 * ## Architecture
 * 
 * ```
 * AutosaveFileService
 * ├── File System Access API (primary storage)
 * ├── IndexedDB (directory handle persistence)
 * ├── Write Queue (race condition prevention)
 * └── Autosave Timers (periodic + debounced)
 * ```
 * 
 * ## Usage Patterns
 * 
 * ### Basic Setup
 * ```typescript
 * const service = new AutosaveFileService({
 *   fileName: 'data.json',
 *   enabled: true,
 *   saveInterval: 120000,  // 2 minutes
 *   debounceDelay: 5000,   // 5 seconds
 * });
 * 
 * // Connect to a folder (requires user gesture)
 * await service.connect();
 * 
 * // Set data provider
 * service.setDataProvider(() => myDataState);
 * ```
 * 
 * ### React Integration
 * ```typescript
 * service.initializeWithReactState(
 *   () => fullData,
 *   (status) => setServiceStatus(status)
 * );
 * 
 * // Notify of changes for debounced save
 * service.notifyDataChange();
 * ```
 * 
 * ## Important Patterns
 * 
 * - **User Gestures**: connect() and connectToExisting() require user interaction
 * - **Permission Flow**: Check → Prompt → Grant → Store Handle → Auto-restore
 * - **Write Serialization**: All writes go through queue to prevent conflicts
 * - **Bulk Detection**: Rapid changes trigger longer debounce delays
/** Classify data format from its shape. */
function detectDataFormat(data: any, alertCount: number): string {
  if (data.cases) return 'transformed';
  if (data.caseRecords) return 'raw';
  if (alertCount > 0) return 'alerts';
  return 'unknown';
}

/**
 * Case Tracking Platform Combined Autosave & File Service v1.0
 *
 * Combines file system operations with autosave functionality to eliminate
 * service coordination complexity and timing issues.
 *
 * Features:
 * - File System Access API with IndexedDB persistence
 * - Intelligent autosave with permission awareness
 * - Single service initialization (no dependency injection)
 * - **Handle Refresh**: Clears cached state to resolve write conflicts
 * 
 * @class AutosaveFileService
 * @version 1.0.0
 */
class AutosaveFileService {
  // File System Access API properties
  /** Handle to the directory selected by the user, or null if not connected */
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  /** Name of the primary data file */
  private fileName: string;
  /** Callback for error notifications */
  private errorCallback: (options: ErrorCallbackOptions) => void;
  /** Unique identifier for this browser tab instance */
  private tabId: string;
  
  // IndexedDB configuration for handle persistence
  /** Name of the IndexedDB database */
  private dbName: string = 'CaseTrackingFileAccess';
  /** Name of the object store within the database */
  private storeName: string = 'directoryHandles';
  /** Key used to store/retrieve the directory handle */
  private dbKey: string = 'caseTrackingDirectory';

  // Write operation queue to prevent race conditions
  /** Queue of pending write operations to process serially */
  private writeQueue: WriteQueueItem[] = [];
  /** Flag indicating whether a write operation is currently in progress */
  private isWriting: boolean = false;

  // Encryption hooks (optional)
  /** Optional encryption hooks for data-at-rest encryption */
  private encryptionHooks: EncryptionHooks | null = null;

  // Autosave properties
  /** Combined configuration options (required fields only) */
  private config: Required<Omit<AutosaveConfig, 'errorCallback' | 'sanitizeFn' | 'statusCallback'>>;
  /** Current service state */
  private state: ServiceState;
  /** Callback for status update notifications */
  private statusCallback: ((status: StatusUpdate) => void) | null;
  /** Function that provides current data to save */
  private dataProvider: (() => any) | null = null;
  /** Active timer references for cleanup */
  private timers: Timers;
  /** Alternative data provider (legacy) */
  private getFullData: (() => any) | null = null;
  /** Callback triggered when data is loaded from file */
  private dataLoadCallback: ((data: any) => void) | null = null;

  /**
   * Create a new AutosaveFileService instance.
   * 
   * The service auto-initializes on construction, attempting to restore
   * any previously saved directory handle from IndexedDB.
   * 
   * @param {AutosaveConfig} [config] - Configuration options
   * @param {string} [config.fileName='case-tracker-data.json'] - Name of the data file
   * @param {Function} [config.errorCallback] - Callback for error notifications
   * @param {string} [config.tabId] - Unique tab identifier (auto-generated if not provided)
   * @param {boolean} [config.enabled=true] - Whether autosave is enabled
   * @param {number} [config.saveInterval=120000] - Interval between periodic saves (ms)
   * @param {number} [config.debounceDelay=5000] - Debounce delay after changes (ms)
   * @param {number} [config.maxRetries=3] - Maximum save retry attempts
   * @param {Function} [config.statusCallback] - Callback for status updates
   * 
   * @example
   * const service = new AutosaveFileService({
   *   fileName: 'my-data.json',
   *   statusCallback: (status) => console.log(status.message),
   *   errorCallback: ({ message }) => console.error(message)
   * });
   */
  constructor({
    fileName = 'case-tracker-data.json',
    errorCallback = () => {},
    tabId = '',
    enabled = true,
    saveInterval = 120000, // 2 minutes
    debounceDelay = 5000, // 5 seconds
    maxRetries = 3,
    statusCallback = () => {},
  }: AutosaveConfig = {}) {
    // File service properties
    this.fileName = fileName;
    this.errorCallback = errorCallback;
    this.tabId = tabId || `case-tracker-tab-${Date.now()}`;

    // Autosave properties
    this.config = {
      fileName,
      tabId: this.tabId,
      enabled,
      saveInterval,
      debounceDelay,
      maxRetries,
    };

    this.state = {
      isRunning: false,
      permissionStatus: 'unknown',
      lastSaveTime: null,
      lastDataChange: null,
      consecutiveFailures: 0,
      pendingSave: false,
    };

    this.statusCallback = statusCallback;
    this.timers = {
      saveInterval: null,
      debounceTimeout: null,
      permissionCheck: null,
    };
    this.dataLoadCallback = null;

    // Auto-initialize (scheduled to avoid async operation in constructor)
    queueMicrotask(() => this.initialize());
  }

  /**
   * Initialize the combined service.
   * 
   * This method:
   * 1. Requests persistent storage (Chromium/Edge)
   * 2. Attempts to restore previous directory access from IndexedDB
   * 3. Starts autosave if enabled
   * 
   * Called automatically by the constructor.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async initialize(): Promise<void> {
    try {
      // Request persistent storage where supported to improve retention across refresh (Chromium/Edge)
      try {
        if (navigator?.storage?.persist) {
          await navigator.storage.persist();
        }
      } catch (_) {
        // non-fatal
      }

      // Try to restore previous directory access
      await this.restoreLastDirectoryAccess();

      // Start autosave if enabled
      if (this.config.enabled) {
        this.startAutosave();
      }

      this.updateStatus('initialized', 'Service ready');
    } catch (error) {
      logger.error('Autosave initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.updateStatus('error', 'Initialization failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // =============================================================================
  // FILE SYSTEM OPERATIONS
  // =============================================================================

  /**
   * Check if the File System Access API is supported in this browser.
   * 
   * @returns {boolean} true if supported, false otherwise
   */
  isSupported(): boolean {
    return 'showDirectoryPicker' in globalThis;
  }

  /**
   * Connect to a directory by prompting the user to select a folder.
   * 
   * This method:
   * 1. Shows the directory picker dialog (requires user gesture)
   * 2. Requests read/write permissions
   * 3. Stores the directory handle in IndexedDB
   * 4. Starts autosave if enabled
   * 
   * **Important:** Must be called in response to a user action (click, etc.)
   * 
   * @returns {Promise<boolean>} true if connection successful and permission granted
   * @throws {AbortError} If user cancels the directory picker (silently handled)
   * 
   * @example
   * // In a button click handler
   * const connected = await service.connect();
   * if (connected) {
   *   console.log('Connected to folder');
   * }
   */
  async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      this.errorCallback({
        message: 'File System Access API is not supported in this browser.',
        type: 'error',
        context: { operation: 'connect' },
      });
      return false;
    }

    try {
      this.directoryHandle = await globalThis.showDirectoryPicker();
      const permissionGranted = await this.requestPermission();

      if (permissionGranted) {
        await this.storeDirectoryHandle();
        this.state.permissionStatus = 'granted';
        this.updateStatus('connected', 'Connected to data folder');

        // DO NOT auto-load existing data on connection
        // Data loading should be explicit user choice
        // await this.loadExistingData(); // Removed

        // Start autosave if not already running
        if (this.config.enabled && !this.state.isRunning) {
          this.startAutosave();
        }
      }

      return permissionGranted;
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        this.updateStatus('error', 'Failed to connect to folder');
      }
      return false;
    }
  }

  /**
   * Connect to an existing stored directory handle.
   * 
   * This method re-establishes a connection to a previously selected directory
   * using the handle stored in IndexedDB. It requires a user gesture to request
   * permissions for the stored handle.
   * 
   * **Important:** Must be called in response to a user action (click, etc.)
   * 
   * Use this method when:
   * - The user returns to the app after closing it
   * - A stored handle exists but permissions need to be re-granted
   * - You want to avoid showing the directory picker again
   * 
   * @returns {Promise<boolean>} true if connection successful and permission granted
   * 
   * @example
   * // In a "Connect to Existing Folder" button handler
   * const connected = await service.connectToExisting();
   * if (connected) {
   *   console.log('Reconnected to previously selected folder');
   * }
   */
  async connectToExisting(): Promise<boolean> {
    if (!this.isSupported()) {
      this.errorCallback({
        message: 'File System Access API is not supported in this browser.',
        type: 'error',
        context: { operation: 'connectExisting' },
      });
      return false;
    }

    if (!this.directoryHandle) {
      const { handle } = await this.restoreLastDirectoryAccess();
      if (!handle) {
        this.updateStatus('error', 'No stored directory handle found');
        return false;
      }
      this.directoryHandle = handle;
    }

    try {
      const permissionGranted = await this.requestPermission();
      if (!permissionGranted) {
        this.updateStatus('waiting', 'Permission denied for existing directory');
        return false;
      }

      this.state.permissionStatus = 'granted';
      this.updateStatus('connected', 'Connected to data folder');
      logger.info('Connected to existing directory', { directoryName: this.directoryHandle?.name });

      if (!await this.validateDirectoryAccess()) return false;

      if (this.config.enabled && !this.state.isRunning) {
        this.startAutosave();
      }
      return true;
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        this.updateStatus('error', 'Failed to connect to existing folder');
      }
      return false;
    }
  }

  /** Verify the directory handle is still accessible after permission grant. */
  private async validateDirectoryAccess(): Promise<boolean> {
    try {
      const testPermission = await this.checkPermission();
      if (testPermission !== 'granted') {
        throw new Error(`Permission check failed: ${testPermission}`);
      }
      logger.info('Directory access validated');
      return true;
    } catch (testError) {
      logger.error('Directory access validation failed', {
        error: testError instanceof Error ? testError.message : String(testError),
      });
      this.directoryHandle = null;
      this.updateStatus('error', 'Failed to validate directory access');
      return false;
    }
  }

  /**
   * Check the current permission state for the directory.
   * 
   * @returns {Promise<PermissionState>} 'granted', 'denied', or 'prompt'
   */
  async checkPermission(): Promise<PermissionState> {
    if (!this.directoryHandle) return 'prompt';
    return await (this.directoryHandle as any).queryPermission({ mode: 'readwrite' });
  }

  /**
   * Request read/write permissions for the directory.
   * 
   * **Important:** Must be called in response to a user action (click, etc.)
   * 
   * @returns {Promise<boolean>} true if permission granted
   * @private
   */
  async requestPermission(): Promise<boolean> {
    if (!this.directoryHandle) return false;

    const permission = await (this.directoryHandle as any).requestPermission({
      mode: 'readwrite',
    });
    if (permission === 'granted') {
      return true;
    }

    this.errorCallback({
      message: 'Permission denied for the directory.',
      type: 'error',
      context: { operation: 'requestPermission' },
    });
    this.updateStatus('waiting', 'Permission required to save changes');
    return false;
  }

  /**
   * Write data to the primary data file.
   * 
   * This method queues the write operation to prevent race conditions.
   * All writes are serialized through a queue and processed one at a time.
   * 
   * Features:
   * - **Automatic encryption** if encryption hooks are configured
   * - **Retry logic** with exponential backoff for transient errors
   * - **Handle refresh** to resolve cached state conflicts
   * - **Race condition prevention** via write queue
   * 
   * @param {any} data - Data to write (will be JSON stringified)
   * @returns {Promise<boolean>} true if write successful, false otherwise
   * 
   * @example
   * const success = await service.writeFile({ cases: [...], alerts: [...] });
   * if (success) {
   *   console.log('Data saved successfully');
   * }
   */
  async writeFile(data: any): Promise<boolean> {
    // Add to write queue to prevent race conditions
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ data, resolve, reject });
      this.processWriteQueue();
    });
  }

  private async processWriteQueue(): Promise<void> {
    // If already processing or queue is empty, return
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;

    try {
      while (this.writeQueue.length > 0) {
        const queueItem = this.writeQueue.shift();
        if (!queueItem) break;

        const { data, resolve, reject } = queueItem;

        try {
          const success = await this._performWrite(data);
          resolve(success);
          
          // Add a small delay between write operations to prevent state conflicts
          if (this.writeQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          logger.error('Write queue operation failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          reject(error);
        }
      }
    } finally {
      this.isWriting = false;
    }
  }

  private async _performWrite(data: any, retryCount: number = 0): Promise<boolean> {
    if (!await this.ensureDirectoryPermission()) return false;

    try {
      // Encrypt data if encryption hooks are available
      let dataToWrite = data;
      if (this.encryptionHooks) {
        logger.debug('Encrypting data before write...');
        dataToWrite = await this.encryptionHooks.encrypt(data);
      }

      // Get a fresh file handle each time to avoid cached state issues
      const fileHandleWrite = await this.directoryHandle!.getFileHandle(
        this.fileName,
        { create: true },
      );
      
      const writable = await fileHandleWrite.createWritable({ keepExistingData: false });
      await writable.write(JSON.stringify(dataToWrite, null, 2));
      await writable.close();

      // Store last save timestamp
      lastSaveStorage.write({
        timestamp: Date.now(),
        tabId: this.tabId,
      });

      if (!this.state.pendingSave) {
        this.state.lastSaveTime = Date.now();
        this.state.consecutiveFailures = 0;
        this.updateStatus('running', 'All changes saved');
      }

      return true;
    } catch (err) {
      const retried = await this.retryWriteOnTransientError(
        err, retryCount, 4, 150,
        (rc) => this._performWrite(data, rc),
        this.fileName
      );
      if (retried !== null) return retried;

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.errorCallback({
        message: `Error writing file "${this.fileName}": ${errorMessage}`,
        type: 'error',
        error: err,
        context: { operation: 'writeData', fileName: this.fileName },
      });
      return false;
    }
  }

  /**
   * Check directory handle and permission, updating status if denied.
   * @returns true if ready to perform I/O
   */
  private async ensureDirectoryPermission(): Promise<boolean> {
    if (!this.directoryHandle) return false;
    const permission = await this.checkPermission();
    this.state.permissionStatus = permission;
    if (permission !== 'granted') {
      this.updateStatus('waiting', 'Permission required to save changes');
      return false;
    }
    return true;
  }

  /**
   * Determine if a write error is a transient state error that can be retried.
   */
  private isRetryableWriteError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : '';
    return msg.includes('state cached in an interface object') ||
           msg.includes('state had changed') ||
           msg.includes('InvalidStateError');
  }

  /**
   * Attempt to retry a write operation after a transient error by refreshing the directory handle.
   * Returns null if no retry was attempted (caller should handle fallback error reporting).
   */
  private async retryWriteOnTransientError(
    err: unknown,
    retryCount: number,
    maxRetries: number,
    retryDelay: number,
    retryFn: (nextRetryCount: number) => Promise<boolean>,
    fileName: string
  ): Promise<boolean | null> {
    if (!this.isRetryableWriteError(err) || retryCount >= maxRetries) return null;

    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const logMessage = `[AutosaveFileService] Write attempt ${retryCount + 1}/${maxRetries + 1} hit a transient state change. Retrying… (${errorMessage})`;
    if (retryCount === 0) { logger.info(logMessage); } else { logger.warn(logMessage); }

    await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));

    try {
      const refreshed = await this.refreshDirectoryHandle();
      if (refreshed) {
        logger.debug('Directory handle refreshed, retrying write', { fileName, attempt: retryCount + 1 });
        return await retryFn(retryCount + 1);
      }
      // Refresh failed — only retry if we still have a valid handle with granted permission
      if (this.directoryHandle) {
        const permission = await this.checkPermission();
        if (permission === 'granted') {
          logger.debug('Handle refresh failed but permission still granted, retrying write', { fileName, attempt: retryCount + 1 });
          return await retryFn(retryCount + 1);
        }
      }
      logger.warn('Cannot retry write: directory handle refresh failed and no valid handle available', {
        fileName,
        hasDirectoryHandle: !!this.directoryHandle,
      });
    } catch (refreshError) {
      logger.warn('Failed to refresh handle for write retry', {
        fileName,
        error: refreshError instanceof Error ? refreshError.message : 'Unknown error',
      });
    }
    return null;
  }

  /**
   * Write JSON data to an arbitrary file name in the connected directory.
   * Returns true on success, false otherwise.
   */
  async writeNamedFile(fileName: string, data: any, retryCount: number = 0): Promise<boolean> {
    if (!await this.ensureDirectoryPermission()) return false;

    try {
      const fileHandle = await this.directoryHandle!.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable({ keepExistingData: false });
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      return true;
    } catch (err) {
      const retried = await this.retryWriteOnTransientError(
        err, retryCount, 4, 150,
        (rc) => this.writeNamedFile(fileName, data, rc),
        fileName
      );
      if (retried !== null) return retried;

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.errorCallback({
        message: `Error writing file "${fileName}": ${errorMessage}`,
        type: 'error',
        error: err,
        context: { operation: 'writeData', fileName },
      });
      return false;
    }
  }

  /**
   * Create a timestamped backup file, then write to the primary file.
   */
  /**
   * Create a timestamped backup file, then write to the primary file.
   * 
   * This method creates a backup with a timestamp in the filename before
   * writing to the main data file. Useful for manual backup operations.
   * 
   * @param {any} data - Data to backup and write
   * @returns {Promise<{backupCreated: boolean, written: boolean, backupName: string}>}
   *   Result with backup status and filename
   * 
   * @example
   * const result = await service.backupAndWrite(data);
   * if (result.backupCreated && result.written) {
   *   console.log(`Backup created: ${result.backupName}`);
   * }
   */
  async backupAndWrite(data: any): Promise<{ backupCreated: boolean; written: boolean; backupName: string }> {
    const ts = new Date().toISOString().replaceAll(':', '-');
    const backupName = `case-tracker-data.backup-${ts}.json`;

    const backupCreated = await this.writeNamedFile(backupName, data);
    const written = await this._performWrite(data);
    return { backupCreated, written, backupName };
  }

  /**
   * Read data from the primary data file.
   * 
   * This method:
   * 1. Checks for directory handle and permissions
   * 2. Reads the file contents
   * 3. Parses JSON
   * 4. Automatically decrypts if encryption hooks are configured
   * 
   * @returns {Promise<any>} The parsed file data, or null if file doesn't exist
   * @throws {Error} If file read fails (excluding NotFoundError)
   * 
   * @example
   * const data = await service.readFile();
   * if (data) {
   *   console.log(`Loaded ${data.cases?.length || 0} cases`);
   * }
   */
  async readFile(): Promise<any> {
    if (!this.directoryHandle) {
      logger.debug('readFile skipped - directory handle is not available');
      return null;
    }

    const permission = await this.checkPermission();
    if (permission !== 'granted') {
      logger.debug('readFile skipped - permission not granted', { permission });
      return null;
    }

    try {
      // Double-check the handle hasn't become null between checks
      if (!this.directoryHandle) {
        logger.warn('Directory handle became null during readFile execution');
        return null;
      }
      
      const fileHandle = await this.directoryHandle.getFileHandle(this.fileName);
      const file = await fileHandle.getFile();
      const contents = await file.text();
      const rawData = JSON.parse(contents);

      // Check if data is encrypted and decrypt if hooks are available
      if (this.encryptionHooks?.isEncrypted(rawData)) {
        logger.debug('Encrypted file detected, decrypting...');
        const decryptedData = await this.encryptionHooks.decrypt(rawData);
        return decryptedData;
      }

      return rawData;
    } catch (err) {
      if (err instanceof Error && err.name === 'NotFoundError') {
        return null;
      } else {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Failed to read primary data file', {
          fileName: this.fileName,
          error: message,
        });
        this.errorCallback({
          message: `Error reading file "${this.fileName}": ${message}`,
          type: 'error',
          error: err,
          context: { operation: 'readData', fileName: this.fileName },
        });
        throw err;
      }
    }
  }

  /**
   * Load existing data from the connected directory.
   * 
   * Reads the primary data file and triggers the data load callback if configured.
   * Logs information about the loaded data format and record counts.
   * 
   * @returns {Promise<any>} The loaded data, or null if no file exists
   * @throws {Error} If file read fails
   */
  async loadExistingData(): Promise<any> {
    try {
      const data = await this.readFile();
      
      if (data) {
        const caseCount = Array.isArray(data.cases) ? data.cases.length : 0;
        const recordCount = Array.isArray(data.caseRecords) ? data.caseRecords.length : 0;
        const alertCount = Array.isArray((data as any).alerts) ? (data as any).alerts.length : 0;
        const format = detectDataFormat(data, alertCount);
        logger.info('Existing data loaded', { format, caseCount, recordCount, alertCount });
        
        if (this.dataLoadCallback) {
          this.dataLoadCallback(data);
        }
      }
      
      return data;
    } catch (error) {
      logger.error('Failed to load existing data', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Load data from a specific named file and trigger the data load callback
   */
  async loadDataFromFile(fileName: string): Promise<any> {
    try {
      logger.info('Loading data from file', { fileName });
      const data = await this.readNamedFile(fileName);
      
      if (data) {
        logger.info('Loaded data from file', {
          fileName,
          caseCount: Array.isArray(data.cases) ? data.cases.length : 0,
          alertCount: Array.isArray((data as any).alerts) ? (data as any).alerts.length : 0,
        });
        
        // Call data load callback if set
        if (this.dataLoadCallback) {
          this.dataLoadCallback(data);
        }
      }
      
      return data;
    } catch (error) {
      logger.error('Failed to load data from file', {
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * List all data files in the connected directory
   */
  async listDataFiles(): Promise<string[]> {
    logger.debug('listDataFiles invoked', {
      directoryHandle: !!this.directoryHandle,
      directoryName: this.directoryHandle?.name || 'none',
    });
    
    if (!this.directoryHandle) {
      logger.debug('listDataFiles skipped - directory handle not set');
      return [];
    }

    const permission = await this.checkPermission();
    logger.debug('listDataFiles permission check result', { permission });
    if (permission !== 'granted') {
      logger.debug('listDataFiles skipped - permission not granted', { permission });
      return [];
    }

    try {
      const dataFiles: string[] = [];
      
      logger.debug('Iterating through directory entries');
      // Iterate through all files in the directory
      for await (const [name, handle] of (this.directoryHandle as any).entries()) {
        logger.debug('Found directory entry', { name, kind: handle.kind });
        if (handle.kind === 'file') {
          // Look for JSON files that could contain case data
          if (name.endsWith('.json')) {
            logger.debug('Adding JSON data file candidate', { name });
            dataFiles.push(name);
          }
        }
      }
      
      logger.info('Directory scan complete', { fileCount: dataFiles.length, files: dataFiles });
      return dataFiles;
    } catch (error) {
      logger.error('Failed to list directory entries', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Read a specific named file from the directory
   */
  async readNamedFile(fileName: string): Promise<any> {
    if (!this.directoryHandle) {
      logger.debug('readNamedFile skipped - directory handle not set', { fileName });
      return null;
    }

    const permission = await this.checkPermission();
    if (permission !== 'granted') {
      logger.debug('readNamedFile skipped - permission not granted', { fileName, permission });
      return null;
    }

    const contents = await this.readWithRetry(fileName, 'readNamedFile');
    if (contents === null) return null;

    const rawData = JSON.parse(contents);
    logger.debug('Successfully read data file', {
      fileName,
      caseCount: Array.isArray(rawData.cases) ? rawData.cases.length : 0,
      alertCount: Array.isArray(rawData.alerts) ? rawData.alerts.length : 0,
    });
    return rawData;
  }

  async readTextFile(fileName: string): Promise<string | null> {
    if (!this.directoryHandle) {
      logger.debug('readTextFile skipped - directory handle not set', { fileName });
      return null;
    }

    const permission = await this.checkPermission();
    if (permission !== 'granted') {
      logger.debug('readTextFile skipped - permission not granted', { fileName, permission });
      return null;
    }

    return this.readWithRetry(fileName, 'readTextFile');
  }

  /**
   * Shared read-with-retry logic for readNamedFile and readTextFile.
   * Retries on NotReadableError with exponential backoff.
   * @returns file text contents, or null if not found / unreadable after retries
   */
  private async readWithRetry(
    fileName: string,
    operation: string,
    maxRetries: number = 3,
  ): Promise<string | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const fileHandle = await this.directoryHandle!.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        return await file.text();
      } catch (err) {
        if (err instanceof Error && err.name === 'NotFoundError') {
          logger.debug(`${operation}: file not found`, { fileName });
          return null;
        }

        if (err instanceof Error && err.name === 'NotReadableError') {
          if (attempt < maxRetries) {
            logger.debug(`NotReadableError on attempt ${attempt}/${maxRetries}, retrying...`, { fileName });
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            continue;
          }
          logger.warn(`Failed to read file after retries (NotReadableError)`, { fileName, attempts: maxRetries });
          return null;
        }

        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Failed to ${operation}`, { fileName, error: message });
        this.errorCallback({
          message: `Error reading file "${fileName}": ${message}`,
          type: 'error',
          error: err,
          context: { operation, fileName },
        });
        throw err;
      }
    }
    return null;
  }

  /**
   * Delete a file from the directory.
   * Used to clean up processed files like Alerts.csv after import.
   * @param fileName - The name of the file to delete
   * @returns true if file was deleted, false if file didn't exist or couldn't be deleted
   */
  async deleteFile(fileName: string): Promise<boolean> {
    if (!this.directoryHandle) {
      logger.debug('deleteFile skipped - directory handle not set', { fileName });
      return false;
    }

    const permission = await this.checkPermission();
    if (permission !== 'granted') {
      logger.debug('deleteFile skipped - permission not granted', { fileName, permission });
      return false;
    }

    try {
      await this.directoryHandle.removeEntry(fileName);
      logger.info('File deleted', { fileName });
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === 'NotFoundError') {
        // File doesn't exist - that's fine
        logger.debug('File not found for deletion', { fileName });
        return false;
      }

      const message = err instanceof Error ? err.message : 'Unknown error';
      // Non-critical - file will be re-imported but that's okay
      logger.debug('Could not delete file (will be re-processed on next import)', { fileName, error: message });
      return false;
    }
  }

  async restoreLastDirectoryAccess(): Promise<{ handle: FileSystemDirectoryHandle | null; permission: PermissionState }> {
    if (!this.isSupported()) {
      this.state.permissionStatus = 'unsupported';
      return { handle: null, permission: 'denied' };
    }

    try {
      const handle = await this.getStoredDirectoryHandle();
      if (handle) {
        this.directoryHandle = handle;
        // Check permission status but DON'T auto-connect (requires user gesture)
        const permission = await this.checkPermission();
        
        if (permission === 'granted') {
          // Permission still exists but we need explicit user action to connect
          this.state.permissionStatus = 'granted'; // We have permission
          this.updateStatus('waiting', 'Ready to connect - click "Connect to Existing"');
          
          logger.info('Directory handle restored from storage', {
            permission,
            directoryName: this.directoryHandle?.name,
          });
        } else {
          // Permission lost or denied - needs re-grant
          this.state.permissionStatus = 'prompt';
          this.updateStatus('waiting', 'Ready to reconnect - permission required');
          
          logger.info('Directory handle restored but permission needs refresh', {
            permission,
            directoryName: this.directoryHandle?.name,
          });
        }
        
        return { handle, permission };
      }
    } catch (error) {
      logger.warn('Directory handle verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      await this.clearStoredDirectoryHandle();
    }
    
    this.state.permissionStatus = 'prompt';
    this.updateStatus('disconnected', 'No data folder connected');
    return { handle: null, permission: 'prompt' };
  }

  /**
   * Attempt to request permission for the current directory handle.
   * Should be called in response to a user gesture (e.g., button click).
   * Returns true if granted.
   */
  async ensurePermission(): Promise<boolean> {
    if (!this.directoryHandle) {
      return false;
    }
    try {
      const result = await (this.directoryHandle as any).requestPermission({
        mode: 'readwrite',
      });
      this.state.permissionStatus = result;
      if (result === 'granted') {
        this.updateStatus('connected', 'Connected to data folder');
        return true;
      }
      this.updateStatus('waiting', 'Permission required to save changes');
      return false;
    } catch (_) {
      this.updateStatus('waiting', 'Permission required to save changes');
      return false;
    }
  }

  // IndexedDB operations for directory handle persistence
  // Delegated to IndexedDBHandleStore module for better separation of concerns
  
  /** Get the IndexedDB configuration for this service instance */
  private getIndexedDBConfig(): IndexedDBHandleStoreConfig {
    return {
      dbName: this.dbName,
      storeName: this.storeName,
      dbKey: this.dbKey,
    };
  }

  private async getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    return getStoredDirectoryHandle(this.getIndexedDBConfig());
  }

  private async storeDirectoryHandle(): Promise<void> {
    if (!this.directoryHandle) return;
    return storeDirectoryHandle(this.directoryHandle, this.getIndexedDBConfig());
  }

  private async clearStoredDirectoryHandle(): Promise<void> {
    return clearStoredDirectoryHandle(this.getIndexedDBConfig());
  }

  /**
   * Refresh the directory handle from IndexedDB to clear cached state.
   * 
   * This is critical for resolving "state cached in interface object" errors
   * that can occur when multiple operations access the same file handle.
   * 
   * @private
   * @returns {Promise<boolean>} true if refresh successful
   */
  private async refreshDirectoryHandle(): Promise<boolean> {
    try {
      const storedHandle = await this.getStoredDirectoryHandle();
      if (!storedHandle) {
        logger.warn('No stored directory handle available for refresh');
        return false;
      }
      
      // Verify the handle is still valid
      const permission = await (storedHandle as any).queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        logger.warn('Refreshed handle does not have granted permission', { permission });
        return false;
      }
      
      // Update the active handle
      this.directoryHandle = storedHandle;
      logger.debug('Directory handle refreshed successfully');
      return true;
    } catch (error) {
      logger.warn('Failed to refresh directory handle', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  // =============================================================================
  // AUTOSAVE OPERATIONS
  // =============================================================================

  /**
   * Set the data provider function.
   * 
   * The data provider is called when autosave needs to get the current
   * data to save. It should return the complete data object to write.
   * 
   * @param {Function} dataProvider - Function that returns current data to save
   * 
   * @example
   * service.setDataProvider(() => currentDataState);
   */
  setDataProvider(dataProvider: () => any): void {
    this.dataProvider = dataProvider;
  }

  /**
   * Update the data provider with a new data reference getter.
   * 
   * @param {Function} getCurrentData - Function that returns current data
   */
  updateDataProvider(getCurrentData: () => any): void {
    this.dataProvider = () => {
      const data = getCurrentData();
      if (!data) {
        return null;
      }
      return data;
    };
  }

  /**
   * Initialize with React state integration.
   * 
   * This method sets up the service to work seamlessly with React state.
   * It configures both the data provider and status callback for a
   * complete React integration.
   * 
   * @param {Function} getFullData - Function that returns current React state
   * @param {Function} [statusCallback] - Optional callback for status updates
   * @returns {AutosaveFileService} this instance for chaining
   * 
   * @example
   * const service = useRef(new AutosaveFileService());
   * 
   * useEffect(() => {
   *   service.current.initializeWithReactState(
   *     () => fullData,
   *     (status) => setServiceStatus(status)
   *   );
   * }, [fullData]);
   */
  initializeWithReactState(getFullData: () => any, statusCallback?: (status: StatusUpdate) => void): AutosaveFileService {
    // Store the data getter for future updates
    this.getFullData = getFullData;

    // Set up data provider that always gets current state
    this.dataProvider = () => {
      const data = this.getFullData?.();
      if (!data) {
        return null;
      }
      return data;
    };

    // Set up status callback if provided
    if (statusCallback) {
      this.statusCallback = statusCallback;
    }

    return this;
  }

  /**
   * Update the React data getter when state reference changes.
   * 
   * Call this when your React state reference changes to ensure
   * the service always has access to current data.
   * 
   * @param {Function} getFullData - Function that returns updated React state
   */
  updateReactState(getFullData: () => any): void {
    if (this.getFullData) {
      this.getFullData = getFullData;
    }
  }

  /**
   * Start the autosave service.
   * 
   * This method:
   * 1. Starts periodic save interval
   * 2. Starts permission checking interval
   * 3. Updates status to 'running'
   * 
   * The service will automatically save data based on:
   * - Periodic interval (default: 2 minutes)
   * - Debounced data changes (default: 5 seconds after change)
   * 
   * Called automatically by constructor if `enabled: true`.
   */
  startAutosave(): void {
    if (this.state.isRunning) {
      return;
    }

    this.state.isRunning = true;

    // Start periodic save interval
    this.timers.saveInterval = setInterval(() => {
      this.performAutosave('interval');
    }, this.config.saveInterval);

    // Start permission checking
    this.timers.permissionCheck = setInterval(() => {
      this.checkPermissions();
    }, 30000); // Check every 30 seconds

    // Immediately report running to match legacy UX, then correct based on permission
    this.updateStatus('running', this.state.lastSaveTime ? 'All changes saved' : 'Autosave active');
    // Do not request permission here to avoid non-gesture prompts
    Promise.resolve()
      .then(() => this.checkPermission?.())
      .then((perm) => {
        if (perm !== 'granted') {
          this.updateStatus('waiting', 'Permission required to save changes');
        }
      })
      .catch(() => {
        this.updateStatus('waiting', 'Permission required to save changes');
      });
  }

  /**
   * Stop the autosave service.
   * 
   * Clears all autosave timers and updates status to 'stopped'.
   * Data will no longer be automatically saved until startAutosave() is called.
   */
  stopAutosave(): void {
    this.state.isRunning = false;

    // Clear all timers
    if (this.timers.saveInterval) {
      clearInterval(this.timers.saveInterval);
      this.timers.saveInterval = null;
    }

    if (this.timers.debounceTimeout) {
      clearTimeout(this.timers.debounceTimeout);
      this.timers.debounceTimeout = null;
    }

    if (this.timers.permissionCheck) {
      clearInterval(this.timers.permissionCheck);
      this.timers.permissionCheck = null;
    }

    this.updateStatus('stopped', 'Autosave stopped');
  }

  /**
   * Notify the service that data has changed.
   * 
   * This triggers a debounced save operation. Multiple rapid calls
   * will be coalesced into a single save operation.
   * 
   * The service automatically detects bulk operations (rapid successive
   * calls within 2 seconds) and uses a longer debounce delay (3x, max 15s)
   * to avoid excessive saves during bulk imports or batch operations.
   * 
   * **Pattern:**
   * - Single changes: 5 second debounce (default)
   * - Bulk operations: 15 second debounce (detected automatically)
   * 
   * @example
   * // After modifying data
   * setData(newData);
   * service.notifyDataChange(); // Will save after 5 seconds
   * 
   * // During bulk import
   * for (const item of items) {
   *   addItem(item);
   *   service.notifyDataChange(); // Detected as bulk, will save once after 15s
   * }
   */
  notifyDataChange(): void {
    if (!this.state.isRunning) return;

    this.state.lastDataChange = Date.now();

    // Clear existing debounce timeout
    if (this.timers.debounceTimeout) {
      clearTimeout(this.timers.debounceTimeout);
    }

    // Use longer debounce delay during bulk operations (detected by frequent data changes)
    const now = Date.now();
    const timeSinceLastChange = this.state.lastDataChange ? now - this.state.lastDataChange : Infinity;
    const isBulkOperation = timeSinceLastChange < 2000; // Changes within 2 seconds suggest bulk operation
    
    const debounceDelay = isBulkOperation 
      ? Math.min(this.config.debounceDelay * 3, 15000) // 3x delay, max 15 seconds
      : this.config.debounceDelay;

    // Set new debounce timeout
    this.timers.debounceTimeout = setTimeout(() => {
      this.performAutosave('debounced');
    }, debounceDelay);
  }

  /**
   * Force an immediate save operation.
   * 
   * This method bypasses the autosave timing and immediately writes
   * current data to disk. Useful for:
   * - Manual "Save" button implementations
   * - Saving before critical operations
   * - Ensuring data is persisted before navigation
   * 
   * @returns {Promise<boolean>} true if save successful, false otherwise
   * 
   * @example
   * // In a "Save Now" button handler
   * const saved = await service.save();
   * if (saved) {
   *   toast.success('Data saved successfully');
   * } else {
   *   toast.error('Save failed - check permissions');
   * }
   */
  async save(): Promise<boolean> {
    if (!this.dataProvider) {
      return false;
    }

    try {
      const data = this.dataProvider();
      if (!data) {
        this.state.pendingSave = false;
        this.updateStatus('running', this.state.lastSaveTime ? 'All changes saved' : 'Autosave active');
        return false;
      }

      this.state.pendingSave = true;
      this.updateStatus('saving', 'Saving changes…');

      const result = await this.writeFile(data);

      this.state.pendingSave = false;

      if (result) {
        this.state.lastSaveTime = Date.now();
        this.state.consecutiveFailures = 0;
        this.updateStatus('running', 'All changes saved');
      } else {
        this.state.consecutiveFailures++;
        this.updateStatus('error', 'Save failed - check folder permissions');
      }

      return result;
    } catch (error) {
      logger.error('Failed to perform immediate save', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.state.consecutiveFailures++;
      this.state.pendingSave = false;
      this.updateStatus('error', 'Save failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
      return false;
    } finally {
      this.state.pendingSave = false;
    }
  }

  /**
   * Perform autosave with retry logic
   */
  private async performAutosave(trigger: string): Promise<void> {
    if (!this.state.isRunning || !this.dataProvider) {
      return;
    }

    // Skip if already saving
    if (this.state.pendingSave) {
      return;
    }

    try {
      this.state.pendingSave = true;
      this.updateStatus('saving', 'Saving changes…');
      
      const data = this.dataProvider();
      if (!data) {
        this.state.pendingSave = false;
        this.updateStatus('running', this.state.lastSaveTime ? 'All changes saved' : 'Autosave active');
        return;
      }

      const success = await this.writeFile(data);
      this.state.pendingSave = false;
      
      if (success) {
        this.state.lastSaveTime = Date.now();
        this.state.consecutiveFailures = 0;
        this.updateStatus('running', 'All changes saved');
      } else {
        this.state.consecutiveFailures++;
        if (this.state.consecutiveFailures >= this.config.maxRetries) {
          this.updateStatus('error', 'Autosave failed - check permissions');
        } else {
          this.updateStatus(
            'retrying',
            `Autosave retrying (${this.state.consecutiveFailures}/${this.config.maxRetries})…`,
          );
        }
      }
    } catch (error) {
      this.state.consecutiveFailures++;
      this.state.pendingSave = false;
      logger.error('Autosave attempt failed', {
        trigger,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.updateStatus('error', 'Autosave error - ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      this.state.pendingSave = false;
    }
  }

  /**
   * Check permissions periodically and update status
   */
  private async checkPermissions(): Promise<void> {
    if (!this.directoryHandle) {
      this.state.permissionStatus = 'prompt';
      this.updateStatus('waiting', 'Permission required to save changes');
      return;
    }

    try {
      const permission = await this.checkPermission();
      this.state.permissionStatus = permission;
      
      if (permission !== 'granted') {
        this.updateStatus('waiting', 'Permission required to save changes');
      } else if (this.state.consecutiveFailures === 0) {
        this.updateStatus('running', this.state.lastSaveTime ? 'All changes saved' : 'Autosave active');
      }
    } catch (error) {
      this.state.permissionStatus = 'prompt';
      this.updateStatus('waiting', 'Permission required to save changes');
    }
  }

  /**
   * Update status and notify callbacks
   */
  private updateStatus(status: string, message: string): void {
    const pendingWrites = this.writeQueue.length + (this.state.pendingSave ? 1 : 0);
    const statusUpdate: StatusUpdate = {
      status,
      message,
      timestamp: Date.now(),
      permissionStatus: this.state.permissionStatus,
      lastSaveTime: this.state.lastSaveTime,
      consecutiveFailures: this.state.consecutiveFailures,
      pendingWrites,
    };

    if (this.statusCallback) {
      this.statusCallback(statusUpdate);
    }
  }

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  /**
   * Get current service status
   */
  getStatus(): ServiceState & { isSupported: boolean; pendingWrites: number } {
    return {
      ...this.state,
      isSupported: this.isSupported(),
      pendingWrites: this.writeQueue.length + (this.state.pendingSave ? 1 : 0),
    };
  }

  /**
   * Update autosave configuration
   */
  updateConfig(newConfig: Partial<Pick<AutosaveConfig, 'enabled' | 'saveInterval' | 'debounceDelay' | 'maxRetries'>>): void {
    // Update config
    Object.assign(this.config, newConfig);

    // Restart timers if running and intervals changed
    if (this.state.isRunning && (newConfig.saveInterval || newConfig.debounceDelay)) {
      this.stopAutosave();
      this.startAutosave();
    }
  }

  /**
   * Set callback for when data is loaded from file
   */
  setDataLoadCallback(callback?: ((data: any) => void) | null): void {
    this.dataLoadCallback = callback ?? null;
  }

  /**
   * Set encryption hooks for data at rest
   * When set, all read/write operations will use these hooks
   */
  setEncryptionHooks(hooks: EncryptionHooks | null): void {
    this.encryptionHooks = hooks;
    logger.lifecycle('Encryption hooks updated', { enabled: !!hooks });
  }

  /**
   * Check if encryption is currently enabled
   */
  hasEncryption(): boolean {
    return this.encryptionHooks !== null;
  }

  /**
   * Disconnect from current directory
   */
  async disconnect(): Promise<void> {
    this.stopAutosave();
    this.directoryHandle = null;
    this.state.permissionStatus = 'prompt';
    await this.clearStoredDirectoryHandle();
    this.updateStatus('disconnected', 'Disconnected from data folder');
  }

  /**
   * Clean up and destroy the service
   */
  destroy(): void {
    this.stopAutosave();
    this.directoryHandle = null;
    this.dataProvider = null;
    this.getFullData = null;
    this.dataLoadCallback = null;
    this.statusCallback = null;
  }

  /**
   * Broadcast data update to listeners
   * Used when data is modified directly via file operations (e.g. DataManager)
   * rather than through the autosave loop
   */
  broadcastDataUpdate(data: any): void {
    if (this.dataLoadCallback) {
      this.dataLoadCallback(data);
    }
  }

  /**
   * Check if the data file exists and whether it's encrypted.
   * Does NOT decrypt - just peeks at the file structure.
   * 
   * @returns { exists: boolean, encrypted: boolean } or null if no directory handle
   */
  async checkFileEncryptionStatus(): Promise<{ exists: boolean; encrypted: boolean } | null> {
    if (!this.directoryHandle) {
      return null;
    }

    const permission = await this.checkPermission();
    if (permission !== 'granted') {
      return null;
    }

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(this.fileName);
      const file = await fileHandle.getFile();
      const contents = await file.text();
      
      if (!contents.trim()) {
        return { exists: true, encrypted: false };
      }
      
      const rawData = JSON.parse(contents);
      // Use standalone type guard — hooks may not be set pre-authentication
      const encrypted = isEncryptedPayload(rawData) || (this.encryptionHooks?.isEncrypted(rawData) ?? false);
      
      return { exists: true, encrypted };
    } catch (err) {
      if (err instanceof Error && err.name === 'NotFoundError') {
        return { exists: false, encrypted: false };
      }
      logger.error('Failed to check file encryption status', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}

export default AutosaveFileService;