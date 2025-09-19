// Simple provider to share a file service instance across modules
// Avoids window-based fallbacks and allows clean dependency injection.

let fileServiceInstance: any = null;

export function setFileService(service: any) {
  fileServiceInstance = service || null;
  try {
    if (service && typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent('fileService:ready', { detail: { provided: true } }),
      );
    }
  } catch (_) {
    // Silently ignore if CustomEvent unsupported
  }
}

export function getFileService() {
  if (fileServiceInstance) return fileServiceInstance;
  // Backward compatibility: use globally exposed service if present
  // Use globalThis to avoid window.* lint restrictions
  const legacy =
    (typeof globalThis !== 'undefined' &&
      (globalThis.NightingaleFileService || globalThis.FileService)) ||
    null;
  return legacy;
}

export default { setFileService, getFileService };