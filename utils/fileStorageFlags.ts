export interface FileStorageFlags {
  dataBaseline?: boolean;
  sessionHadData?: boolean;
  inSetupPhase?: boolean;
  inConnectionFlow?: boolean;
}

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
    Object.keys(this.flags).forEach(key => {
      delete this.flags[key as keyof FileStorageFlags];
    });
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
