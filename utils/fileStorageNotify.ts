const FILE_STORAGE_CHANGE_EVENT = "cmsnext:file-storage-change";

export function safeNotifyFileStorageChange(): void {
  if (globalThis.window === undefined) {
    return;
  }

  try {
    globalThis.window.dispatchEvent(new CustomEvent(FILE_STORAGE_CHANGE_EVENT));
  } catch (error) {
    // Notification is best-effort; ignore failures so the application keeps running.
    globalThis.console?.warn?.("Failed to dispatch file storage event", error);
  }
}
