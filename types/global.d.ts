// Global type augmentations for the application (DOM shims/merges)
declare global {
  interface FileSystemPermissionDescriptor {
    mode?: 'read' | 'readwrite';
  }

  // Merge/augment the Directory handle with methods used in app
  interface FileSystemDirectoryHandle {
    // Note: lib.dom already provides kind/name; ensure signatures exist where missing
    queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<FileSystemHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    // Optional in some environments
    resolve?(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
    isSameEntry?(other: FileSystemHandle): Promise<boolean>;
  }

  type FileSystemWriteChunkType = BufferSource | Blob | string;

  interface FileSystemWritableFileStream {
    write(data: FileSystemWriteChunkType): Promise<void>;
    close(): Promise<void>;
  }

  interface FileSystemFileHandle {
    getFile(): Promise<File>;
    createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
  }

  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
    handleFileDataLoaded?: (fileData: unknown) => void;
    fileStorageNotifyChange?: () => void;
  }

  var NightingaleFileService: unknown;
  var FileService: unknown;

  interface ImportMetaEnv {
    readonly VITE_PERSIST_NORMALIZATION_FIXES?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};