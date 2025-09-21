/// <reference path="../types/global.d.ts" />

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

interface AutosaveConfig {
  fileName?: string;
  errorCallback?: (message: string, type?: string) => void;
  sanitizeFn?: (str: string) => string;
  tabId?: string;
  enabled?: boolean;
  saveInterval?: number;
  debounceDelay?: number;
  maxRetries?: number;
  statusCallback?: (status: StatusUpdate) => void;
}

interface StatusUpdate {
  status: string;
  message: string;
  timestamp: number;
  permissionStatus: string;
  lastSaveTime: number | null;
  consecutiveFailures: number;
}

interface ServiceState {
  isRunning: boolean;
  permissionStatus: string;
  lastSaveTime: number | null;
  lastDataChange: number | null;
  consecutiveFailures: number;
  pendingSave: boolean;
}

interface Timers {
  saveInterval: NodeJS.Timeout | null;
  debounceTimeout: NodeJS.Timeout | null;
  permissionCheck: NodeJS.Timeout | null;
}

interface WriteQueueItem {
  data: any;
  resolve: (value: boolean) => void;
  reject: (reason: any) => void;
}

/**
 * Combined Autosave and File Service
 * Handles both file operations and automatic saving
 */
class AutosaveFileService {
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private fileName: string;
  private errorCallback: (message: string, type?: string) => void;
  private tabId: string;
  private dbName: string = 'CaseTrackingFileAccess';
  private storeName: string = 'directoryHandles';
  private dbKey: string = 'caseTrackingDirectory';

  // Write operation queue to prevent race conditions
  private writeQueue: WriteQueueItem[] = [];
  private isWriting: boolean = false;

  // Autosave properties
  private config: Required<Omit<AutosaveConfig, 'errorCallback' | 'sanitizeFn' | 'statusCallback'>>;
  private state: ServiceState;
  private statusCallback: ((status: StatusUpdate) => void) | null;
  private dataProvider: (() => any) | null = null;
  private timers: Timers;
  private getFullData: (() => any) | null = null;
  private dataLoadCallback: ((data: any) => void) | null = null;

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

    // Auto-initialize
    this.initialize();
  }

  /**
   * Initialize the combined service
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
      console.error('Autosave init failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      this.updateStatus('error', 'Initialization failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // =============================================================================
  // FILE SYSTEM OPERATIONS
  // =============================================================================

  isSupported(): boolean {
    return 'showDirectoryPicker' in window;
  }

  async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      this.errorCallback(
        'File System Access API is not supported in this browser.',
        'error',
      );
      return false;
    }

    try {
      this.directoryHandle = await (window as any).showDirectoryPicker();
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
   * This requires a user gesture and uses the already stored handle.
   */
  async connectToExisting(): Promise<boolean> {
    if (!this.isSupported()) {
      this.errorCallback(
        'File System Access API is not supported in this browser.',
        'error',
      );
      return false;
    }

    if (!this.directoryHandle) {
      // Try to restore the handle first
      const { handle } = await this.restoreLastDirectoryAccess();
      if (!handle) {
        this.updateStatus('error', 'No stored directory handle found');
        return false;
      }
      // Ensure the handle is properly assigned
      this.directoryHandle = handle;
    }

    try {
      // Request permission for the existing handle (requires user gesture)
      const permissionGranted = await this.requestPermission();

      if (permissionGranted) {
        this.state.permissionStatus = 'granted';
        this.updateStatus('connected', 'Connected to data folder');

        console.log('[AutosaveFileService] Successfully connected to existing directory');

        // Validate that we can actually access the directory
        try {
          // Test the connection by checking if we can access the directory
          const testPermission = await this.checkPermission();
          if (testPermission !== 'granted') {
            throw new Error(`Permission check failed: ${testPermission}`);
          }
          console.log('[AutosaveFileService] Directory access validated successfully');
        } catch (testError) {
          console.error('[AutosaveFileService] Directory access validation failed:', testError);
          this.directoryHandle = null;
          this.updateStatus('error', 'Failed to validate directory access');
          return false;
        }

        // Start autosave if not already running
        if (this.config.enabled && !this.state.isRunning) {
          this.startAutosave();
        }

        return true;
      } else {
        this.updateStatus('waiting', 'Permission denied for existing directory');
        return false;
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        this.updateStatus('error', 'Failed to connect to existing folder');
      }
      return false;
    }
  }

  async checkPermission(): Promise<PermissionState> {
    if (!this.directoryHandle) return 'prompt';
    return await (this.directoryHandle as any).queryPermission({ mode: 'readwrite' });
  }

  async requestPermission(): Promise<boolean> {
    if (!this.directoryHandle) return false;

    const permission = await (this.directoryHandle as any).requestPermission({
      mode: 'readwrite',
    });
    if (permission === 'granted') {
      return true;
    }

    this.errorCallback('Permission denied for the directory.', 'error');
    return false;
  }

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
        } catch (error) {
          console.error('Write operation failed', { error: error instanceof Error ? error.message : 'Unknown error' });
          reject(error);
        }
      }
    } finally {
      this.isWriting = false;
    }
  }

  private async _performWrite(data: any): Promise<boolean> {
    // Check if we have a directory handle and permissions
    if (!this.directoryHandle) {
      return false;
    }

    const permission = await this.checkPermission();
    if (permission !== 'granted') {
      return false;
    }

    try {
      const fileHandleWrite = await this.directoryHandle.getFileHandle(
        this.fileName,
        { create: true },
      );
      const writable = await fileHandleWrite.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();

      // Store last save timestamp
      localStorage.setItem(
        'case-tracker-last-save',
        JSON.stringify({
          timestamp: Date.now(),
          tabId: this.tabId,
        }),
      );

      return true;
    } catch (err) {
      this.errorCallback(
        `Error writing file "${this.fileName}": ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
      return false;
    }
  }

  /**
   * Write JSON data to an arbitrary file name in the connected directory.
   * Returns true on success, false otherwise.
   */
  async writeNamedFile(fileName: string, data: any): Promise<boolean> {
    if (!this.directoryHandle) {
      return false;
    }

    const permission = await this.checkPermission();
    if (permission !== 'granted') {
      return false;
    }

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(fileName, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      return true;
    } catch (err) {
      this.errorCallback(
        `Error writing file "${fileName}": ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
      return false;
    }
  }

  /**
   * Create a timestamped backup file, then write to the primary file.
   */
  async backupAndWrite(data: any): Promise<{ backupCreated: boolean; written: boolean; backupName: string }> {
    const ts = new Date().toISOString().replace(/[:]/g, '-');
    const backupName = `case-tracker-data.backup-${ts}.json`;

    const backupCreated = await this.writeNamedFile(backupName, data);
    const written = await this._performWrite(data);
    return { backupCreated, written, backupName };
  }

  async readFile(): Promise<any> {
    if (!this.directoryHandle) {
      console.error('[AutosaveFileService] readFile called but directoryHandle is null');
      return null;
    }

    const permission = await this.checkPermission();
    if (permission !== 'granted') {
      console.error('[AutosaveFileService] readFile called but permission is not granted:', permission);
      return null;
    }

    try {
      // Double-check the handle hasn't become null between checks
      if (!this.directoryHandle) {
        console.error('[AutosaveFileService] Directory handle became null during readFile execution');
        return null;
      }
      
      const fileHandle = await this.directoryHandle.getFileHandle(this.fileName);
      const file = await fileHandle.getFile();
      const contents = await file.text();
      const rawData = JSON.parse(contents);

      return rawData;
    } catch (err) {
      if (err instanceof Error && err.name === 'NotFoundError') {
        return null;
      } else {
        this.errorCallback(
          `Error reading file "${this.fileName}": ${err instanceof Error ? err.message : 'Unknown error'}`,
          'error',
        );
        throw err;
      }
    }
  }

  /**
   * Load existing data from the connected directory
   */
  async loadExistingData(): Promise<any> {
    try {
      const data = await this.readFile();
      
      if (data) {
        // Log appropriate count based on data format
        const caseCount = data.cases?.length || data.caseRecords?.length || 0;
        const format = data.cases ? 'transformed' : data.caseRecords ? 'raw' : 'unknown';
        console.log(`[AutosaveFileService] Successfully loaded existing data with ${caseCount} records (${format} format)`);
        
        // Call data load callback if set
        if (this.dataLoadCallback) {
          this.dataLoadCallback(data);
        }
      }
      
      return data;
    } catch (error) {
      console.error('[AutosaveFileService] Failed to load existing data:', error);
      throw error;
    }
  }

  /**
   * Load data from a specific named file and trigger the data load callback
   */
  async loadDataFromFile(fileName: string): Promise<any> {
    try {
      console.log(`[AutosaveFileService] Loading data from file: ${fileName}`);
      const data = await this.readNamedFile(fileName);
      
      if (data) {
        console.log(`[AutosaveFileService] Successfully loaded data from ${fileName} with ${data.cases?.length || 0} cases`);
        
        // Call data load callback if set
        if (this.dataLoadCallback) {
          this.dataLoadCallback(data);
        }
      }
      
      return data;
    } catch (error) {
      console.error(`[AutosaveFileService] Failed to load data from ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * List all data files in the connected directory
   */
  async listDataFiles(): Promise<string[]> {
    console.log('[AutosaveFileService] listDataFiles called', {
      directoryHandle: !!this.directoryHandle,
      directoryName: this.directoryHandle?.name || 'none'
    });
    
    if (!this.directoryHandle) {
      console.log('[AutosaveFileService] No directory handle, returning empty array');
      return [];
    }

    const permission = await this.checkPermission();
    console.log('[AutosaveFileService] Permission check result:', permission);
    if (permission !== 'granted') {
      console.log('[AutosaveFileService] Permission not granted, returning empty array');
      return [];
    }

    try {
      const dataFiles: string[] = [];
      
      console.log('[AutosaveFileService] Iterating through directory entries...');
      // Iterate through all files in the directory
      for await (const [name, handle] of (this.directoryHandle as any).entries()) {
        console.log('[AutosaveFileService] Found entry:', { name, kind: handle.kind });
        if (handle.kind === 'file') {
          // Look for JSON files that could contain case data
          if (name.endsWith('.json')) {
            console.log('[AutosaveFileService] Adding JSON file:', name);
            dataFiles.push(name);
          }
        }
      }
      
      console.log('[AutosaveFileService] Final file list:', dataFiles);
      return dataFiles;
    } catch (error) {
      console.error('[AutosaveFileService] Failed to list data files:', error);
      return [];
    }
  }

  /**
   * Read a specific named file from the directory
   */
  async readNamedFile(fileName: string): Promise<any> {
    if (!this.directoryHandle) {
      return null;
    }

    const permission = await this.checkPermission();
    if (permission !== 'granted') {
      return null;
    }

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const contents = await file.text();
      const rawData = JSON.parse(contents);

      console.log(`[AutosaveFileService] Successfully read file: ${fileName} with ${rawData.cases?.length || 0} cases`);
      
      return rawData;
    } catch (err) {
      if (err instanceof Error && err.name === 'NotFoundError') {
        return null;
      } else {
        console.error(`[AutosaveFileService] Error reading file "${fileName}":`, err);
        throw err;
      }
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
          
          console.log('[AutosaveFileService] Directory handle restored with granted permission - ready to connect');
        } else {
          // Permission lost or denied - needs re-grant
          this.state.permissionStatus = 'prompt';
          this.updateStatus('waiting', 'Ready to reconnect - permission required');
          
          console.log('[AutosaveFileService] Directory handle found but permission status:', permission);
        }
        
        return { handle, permission };
      }
    } catch (error) {
      console.warn('Directory handle verification failed', {
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
      this.updateStatus('waiting', 'Waiting for folder connection');
      return false;
    } catch (_) {
      this.updateStatus('waiting', 'Waiting for folder connection');
      return false;
    }
  }

  // IndexedDB operations for directory handle persistence
  private async getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          resolve(null);
          return;
        }
        const getRequest = db
          .transaction(this.storeName)
          .objectStore(this.storeName)
          .get(this.dbKey);
        getRequest.onsuccess = () => resolve(getRequest.result?.handle || null);
        getRequest.onerror = () => resolve(null);
      };
      request.onupgradeneeded = (e) => {
        (e.target as IDBOpenDBRequest).result.createObjectStore(this.storeName);
      };
    });
  }

  private async storeDirectoryHandle(): Promise<void> {
    if (!this.directoryHandle) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = (e) => reject(e);
      request.onsuccess = () => {
        const db = request.result;
        const putRequest = db
          .transaction(this.storeName, 'readwrite')
          .objectStore(this.storeName)
          .put({ handle: this.directoryHandle }, this.dbKey);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = (e) => reject(e);
      };
    });
  }

  private async clearStoredDirectoryHandle(): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          resolve();
          return;
        }
        const deleteRequest = db
          .transaction(this.storeName, 'readwrite')
          .objectStore(this.storeName)
          .delete(this.dbKey);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => resolve();
      };
      request.onerror = () => resolve();
    });
  }

  // =============================================================================
  // AUTOSAVE OPERATIONS
  // =============================================================================

  /**
   * Set the data provider function (allows dynamic updates)
   */
  setDataProvider(dataProvider: () => any): void {
    this.dataProvider = dataProvider;
  }

  /**
   * Update the data provider with current data reference
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
   * Initialize with React state integration
   * This method handles the common React pattern of passing a state getter
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
   * Update the React data getter (for when state reference changes)
   */
  updateReactState(getFullData: () => any): void {
    if (this.getFullData) {
      this.getFullData = getFullData;
    }
  }

  /**
   * Start the autosave service
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
    this.updateStatus('running', 'Autosave active');
    // Do not request permission here to avoid non-gesture prompts
    Promise.resolve()
      .then(() => this.checkPermission?.())
      .then((perm) => {
        if (perm !== 'granted') {
          this.updateStatus('waiting', 'Waiting for folder connection');
        }
      })
      .catch(() => {
        this.updateStatus('waiting', 'Waiting for folder connection');
      });
  }

  /**
   * Stop the autosave service
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
   * Notify that data has changed (for debounced saves)
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
   * Force an immediate save
   */
  async save(): Promise<boolean> {
    if (!this.dataProvider) {
      return false;
    }

    try {
      const data = this.dataProvider();
      if (!data) {
        return false;
      }

      return await this.writeFile(data);
    } catch (error) {
      console.error('Failed to perform immediate save:', error);
      return false;
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
      
      const data = this.dataProvider();
      if (!data) {
        return;
      }

      const success = await this.writeFile(data);
      
      if (success) {
        this.state.lastSaveTime = Date.now();
        this.state.consecutiveFailures = 0;
        this.updateStatus('running', 'Autosave active');
      } else {
        this.state.consecutiveFailures++;
        if (this.state.consecutiveFailures >= this.config.maxRetries) {
          this.updateStatus('error', 'Autosave failed - check permissions');
        } else {
          this.updateStatus('retrying', `Autosave failed - retrying (${this.state.consecutiveFailures}/${this.config.maxRetries})`);
        }
      }
    } catch (error) {
      this.state.consecutiveFailures++;
      console.error(`Autosave failed (${trigger}):`, error);
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
      this.updateStatus('waiting', 'Waiting for folder connection');
      return;
    }

    try {
      const permission = await this.checkPermission();
      this.state.permissionStatus = permission;
      
      if (permission !== 'granted') {
        this.updateStatus('waiting', 'Waiting for folder connection');
      } else if (this.state.consecutiveFailures === 0) {
        this.updateStatus('running', 'Autosave active');
      }
    } catch (error) {
      this.state.permissionStatus = 'prompt';
      this.updateStatus('waiting', 'Waiting for folder connection');
    }
  }

  /**
   * Update status and notify callbacks
   */
  private updateStatus(status: string, message: string): void {
    const statusUpdate: StatusUpdate = {
      status,
      message,
      timestamp: Date.now(),
      permissionStatus: this.state.permissionStatus,
      lastSaveTime: this.state.lastSaveTime,
      consecutiveFailures: this.state.consecutiveFailures,
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
  getStatus(): ServiceState & { isSupported: boolean } {
    return {
      ...this.state,
      isSupported: this.isSupported(),
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
  setDataLoadCallback(callback: (data: any) => void): void {
    this.dataLoadCallback = callback;
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
}

export default AutosaveFileService;