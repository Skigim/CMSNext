export interface FileStorageFlags {
  dataBaseline?: boolean;
  sessionHadData?: boolean;
  inSetupPhase?: boolean;
  inConnectionFlow?: boolean;
}

const flags: FileStorageFlags = {};
let initialized = false;

export function getFileStorageFlags(): Readonly<FileStorageFlags> {
  return flags;
}

export function updateFileStorageFlags(updates: Partial<FileStorageFlags>): void {
  Object.assign(flags, updates);
}

export function clearFileStorageFlags(...keys: (keyof FileStorageFlags)[]): void {
  keys.forEach(key => {
    delete flags[key];
  });
}

export function resetFileStorageFlags(): void {
  Object.keys(flags).forEach(key => {
    delete flags[key as keyof FileStorageFlags];
  });
}

export function markFileStorageInitialized(): boolean {
  if (initialized) {
    return false;
  }

  initialized = true;
  return true;
}
