export type CaseListViewPreference = "grid" | "table";

const PERSISTENT_FLAG_KEYS = ["caseListView"] as const;
type PersistentFlagKey = (typeof PERSISTENT_FLAG_KEYS)[number];
type PersistentFlagsSnapshot = Pick<FileStorageFlags, PersistentFlagKey>;

export interface FileStorageFlags {
  dataBaseline?: boolean;
  sessionHadData?: boolean;
  inSetupPhase?: boolean;
  inConnectionFlow?: boolean;
  caseListView?: CaseListViewPreference;
}

/**
 * Manages file storage state flags.
 * 
 * ARCHITECTURE NOTE: This intentionally uses localStorage for UI preferences
 * (e.g., caseListView) which are separate from case data managed by FileStorageAPI.
 * Session flags (dataBaseline, inConnectionFlow) are memory-only and do not persist.
 * This does NOT violate the "no localStorage for case data" guideline - those
 * preferences would be lost if stored in the file system and need browser-level persistence.
 */
export class FileStorageFlagsManager {
  private static readonly STORAGE_KEY = "cmsnext.fileStorageFlags";

  private flags: FileStorageFlags = {};
  private initialized = false;

  constructor() {
    this.loadPersistentFlags();
  }

  getFileStorageFlags(): Readonly<FileStorageFlags> {
    return this.flags;
  }

  updateFileStorageFlags(updates: Partial<FileStorageFlags>): void {
    Object.assign(this.flags, updates);
    this.persistPersistentFlags();
  }

  clearFileStorageFlags(...keys: (keyof FileStorageFlags)[]): void {
    keys.forEach(key => {
      delete this.flags[key];
    });
    this.persistPersistentFlags();
  }

  resetFileStorageFlags(): void {
    const preservedEntries: Partial<FileStorageFlags> = {};

    PERSISTENT_FLAG_KEYS.forEach(key => {
      const value = this.flags[key];
      if (value !== undefined) {
        preservedEntries[key] = value;
      }
    });

    this.flags = { ...preservedEntries };
    this.persistPersistentFlags();
    this.initialized = false;
  }

  markFileStorageInitialized(): boolean {
    if (this.initialized) {
      return false;
    }

    this.initialized = true;
    return true;
  }

  private loadPersistentFlags(): void {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    try {
      const stored = window.localStorage.getItem(FileStorageFlagsManager.STORAGE_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as Partial<FileStorageFlags> | null;
      if (!parsed || typeof parsed !== "object") {
        return;
      }

      PERSISTENT_FLAG_KEYS.forEach(key => {
        if (key in parsed) {
          const value = parsed[key];
          if (value !== undefined) {
            this.flags[key] = value as PersistentFlagsSnapshot[typeof key];
          }
        }
      });
    } catch (error) {
      console.warn("Failed to load persistent file storage flags", error);
    }
  }

  private persistPersistentFlags(): void {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    try {
      const snapshot: Partial<PersistentFlagsSnapshot> = {};
      PERSISTENT_FLAG_KEYS.forEach(key => {
        const value = this.flags[key];
        if (value !== undefined) {
          snapshot[key] = value;
        }
      });

      if (Object.keys(snapshot).length === 0) {
        window.localStorage.removeItem(FileStorageFlagsManager.STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(
        FileStorageFlagsManager.STORAGE_KEY,
        JSON.stringify(snapshot),
      );
    } catch (error) {
      console.warn("Failed to persist file storage flags", error);
    }
  }
}

let manager: FileStorageFlagsManager = new FileStorageFlagsManager();

export function setFileStorageFlagsManager(customManager: FileStorageFlagsManager): void {
  manager = customManager;
}

export function restoreDefaultFileStorageFlagsManager(): void {
  manager = new FileStorageFlagsManager();
}

export function getFileStorageFlags(): Readonly<FileStorageFlags> {
  return manager.getFileStorageFlags();
}

export function updateFileStorageFlags(updates: Partial<FileStorageFlags>): void {
  manager.updateFileStorageFlags(updates);
}

export function clearFileStorageFlags(...keys: (keyof FileStorageFlags)[]): void {
  manager.clearFileStorageFlags(...keys);
}

export function resetFileStorageFlags(): void {
  manager.resetFileStorageFlags();
}

export function markFileStorageInitialized(): boolean {
  return manager.markFileStorageInitialized();
}
