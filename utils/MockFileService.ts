import AutosaveFileService from './AutosaveFileService';

/**
 * MockFileService — E2E Testing Mock for AutosaveFileService
 *
 * Replaces AutosaveFileService in E2E test runs (VITE_E2E_MOCK_MODE=true).
 * Bypasses the native File System Access API so headless Playwright tests
 * run deterministically without OS dialog blockers.
 *
 * Uses dynamic imports for sample-data.json so it is never bundled into
 * production builds.
 */

type AnyFn = (...args: any[]) => any;

interface MockStatus {
  isRunning: boolean;
  permissionStatus: string;
  lastSaveTime: number | null;
  consecutiveFailures: number;
  pendingSave: boolean;
  isSupported: boolean;
  pendingWrites: number;
  lastDataChange: number | null;
}

/** Delay before emitting the initial status callback, matching real service async init. */
const INITIAL_STATUS_DELAY_MS = 100;

export class MockFileService extends AutosaveFileService {
  constructor(config: ConstructorParameters<typeof AutosaveFileService>[0]) {
    const resolvedConfig = config ?? {};
    super(resolvedConfig);
    setTimeout(() => {
      resolvedConfig.statusCallback?.({
        status: 'running',
        message: 'Mock service ready',
        timestamp: Date.now(),
        permissionStatus: 'granted',
        lastSaveTime: Date.now(),
        consecutiveFailures: 0,
        pendingWrites: 0,
      });
    }, INITIAL_STATUS_DELAY_MS);
  }

  isSupported(): boolean {
    return true;
  }

  async initialize(): Promise<void> {
    // no-op
  }

  async connect(): Promise<boolean> {
    return true;
  }

  async connectToExisting(): Promise<boolean> {
    return true;
  }

  async disconnect(): Promise<void> {
    // no-op
  }

  async save(): Promise<boolean> {
    return true;
  }

  async ensurePermission(): Promise<boolean> {
    return true;
  }

  async checkPermission(): Promise<PermissionState> {
    return 'granted';
  }

  async requestPermission(): Promise<boolean> {
    return true;
  }

  async loadExistingData(): Promise<unknown> {
    // Dynamic import prevents bundle bloat in production
    const { default: sampleData } = await import('../sample-data.json');
    return sampleData;
  }

  async loadDataFromFile(_fileName: string): Promise<unknown> {
    const { default: sampleData } = await import('../sample-data.json');
    return sampleData;
  }

  async readFile(): Promise<unknown> {
    const { default: sampleData } = await import('../sample-data.json');
    return sampleData;
  }

  async readTextFile(_fileName: string): Promise<string | null> {
    return null;
  }

  async readNamedFile(_fileName: string): Promise<unknown> {
    return null;
  }

  async writeFile(_data: unknown): Promise<boolean> {
    return true;
  }

  async backupAndWrite(
    _data: unknown,
  ): Promise<{ backupCreated: boolean; written: boolean; backupName: string }> {
    return { backupCreated: false, written: true, backupName: '' };
  }

  async deleteFile(_fileName: string): Promise<boolean> {
    return true;
  }

  async restoreLastDirectoryAccess(): Promise<{
    handle: FileSystemDirectoryHandle | null;
    permission: PermissionState;
  }> {
    return { handle: null, permission: 'granted' };
  }

  getStatus(): MockStatus {
    return {
      isRunning: true,
      permissionStatus: 'granted',
      lastSaveTime: Date.now(),
      consecutiveFailures: 0,
      pendingSave: false,
      isSupported: true,
      pendingWrites: 0,
      lastDataChange: null,
    };
  }

  async listDataFiles(): Promise<string[]> {
    return ['case-tracker-data.json'];
  }

  setDataLoadCallback(cb?: ((data: unknown) => void) | null): void {
    if (cb) {
      import('../sample-data.json').then(({ default: sampleData }) => cb(sampleData));
    }
  }

  initializeWithReactState(_getFullData: () => any, _statusCallback?: AnyFn): this {
    return this;
  }

  updateReactState(_getFullData: () => any): void {
    // no-op
  }

  setDataProvider(_dataProvider: () => any): void {
    // no-op
  }

  notifyDataChange(): void {
    // no-op
  }

  broadcastDataUpdate(_data: unknown): void {
    // no-op
  }

  updateConfig(): void {
    // no-op
  }

  startAutosave(): void {
    // no-op
  }

  stopAutosave(): void {
    // no-op
  }

  setEncryptionHooks(_hooks: unknown): void {
    // no-op
  }

  hasEncryption(): boolean {
    return false;
  }

  async checkFileEncryptionStatus(): Promise<{ exists: boolean; encrypted: boolean } | null> {
    return { exists: true, encrypted: false };
  }

  destroy(): void {
    // no-op
  }
}
