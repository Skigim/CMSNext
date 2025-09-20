// File System Access API types
interface FileSystemDirectoryHandle {
  queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface Window {
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
}

// Global type augmentations for the application
declare global {
  // eslint-disable-next-line no-var
  var NightingaleFileService: any;
  // eslint-disable-next-line no-var
  var FileService: any;
}

export {};