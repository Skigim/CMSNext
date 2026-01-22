/**
 * File Storage Flags Utilities
 * ============================
 * Manages transient state flags for file storage operations.
 * Tracks connection flow state, setup phases, and data baselines.
 * 
 * ## Flag Types
 * 
 * - **dataBaseline**: Whether initial data baseline has been established
 * - **sessionHadData**: Whether session started with existing data
 * - **inSetupPhase**: Whether user is in initial setup process
 * - **inConnectionFlow**: Whether currently in file connection dialog
 * 
 * ## Architecture Note
 * 
 * All flags are session-only (memory-only) and reset on page refresh.
 * No persistence to localStorage - these are transient UI states.
 * 
 * @module fileStorageFlags
 */

export interface FileStorageFlags {
  dataBaseline?: boolean;
  sessionHadData?: boolean;
  inSetupPhase?: boolean;
  inConnectionFlow?: boolean;
}

/**
 * Manages file storage state flags.
 * 
 * All flags are session-only (in-memory) and do not persist across page reloads.
 * This is intentional - these flags track transient connection/setup state.
 */
export class FileStorageFlagsManager {
  private flags: FileStorageFlags = {};
  private initialized = false;

  getFileStorageFlags(): Readonly<FileStorageFlags> {
    return this.flags;
  }

  updateFileStorageFlags(updates: Partial<FileStorageFlags>): void {
    Object.assign(this.flags, updates);
  }

  clearFileStorageFlags(...keys: (keyof FileStorageFlags)[]): void {
    keys.forEach(key => {
      delete this.flags[key];
    });
  }

  resetFileStorageFlags(): void {
    this.flags = {};
    this.initialized = false;
  }

  markFileStorageInitialized(): boolean {
    if (this.initialized) {
      return false;
    }

    this.initialized = true;
    return true;
  }
}

const manager: FileStorageFlagsManager = new FileStorageFlagsManager();

export function getFileStorageFlags(): Readonly<FileStorageFlags> {
  return manager.getFileStorageFlags();
}

export function updateFileStorageFlags(updates: Partial<FileStorageFlags>): void {
  manager.updateFileStorageFlags(updates);
}

export function resetFileStorageFlags(): void {
  manager.resetFileStorageFlags();
}

export function markFileStorageInitialized(): boolean {
  return manager.markFileStorageInitialized();
}
