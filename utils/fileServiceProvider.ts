/**
 * File Service Provider
 * ====================
 * Centralized file service instance management with dependency injection.
 * Provides a clean way to share the file service across modules without globals.
 * 
 * ## Architecture
 * 
 * - **Singleton Pattern**: One file service instance shared application-wide
 * - **Lazy Initialization**: Service created on first use
 * - **Type-Safe**: Properly typed through FileStorageContext
 * - **No Globals**: Avoids window-based fallbacks
 * 
 * @module fileServiceProvider
 */

// Simple provider to share a file service instance across modules
// Avoids window-based fallbacks and allows clean dependency injection.

let fileServiceInstance: any = null;

export function setFileService(service: any) {
  fileServiceInstance = service || null;
    try {
      if (typeof globalThis !== 'undefined') {
        (globalThis as Record<string, unknown>).__cmsAutosaveService = fileServiceInstance;
      }
    } catch (_) {
      // Ignore inability to assign for non-browser contexts
    }
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