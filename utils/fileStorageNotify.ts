const FILE_STORAGE_CHANGE_EVENT = "cmsnext:file-storage-change";

export function safeNotifyFileStorageChange(): void {
  if (globalThis.window === undefined) {
    return;
  }

  try {
    globalThis.window.dispatchEvent(new CustomEvent(FILE_STORAGE_CHANGE_EVENT));
  } catch {}
}
