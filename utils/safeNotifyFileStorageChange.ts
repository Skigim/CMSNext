import { getFileService } from "./fileServiceProvider";
import { createLogger } from "./logger";

const logger = createLogger("FileStorageNotify");

/**
 * Best-effort notification helper for file storage mutations.
 *
 * The FileSystem Access API occasionally throws when the backing handle
 * changes between operations. This helper centralises the try/catch so every
 * mutation can opt-in without repeating boilerplate logging or guards.
 */
export function safeNotifyFileStorageChange(): void {
  try {
    const service = getFileService();
    if (service && typeof service.notifyDataChange === "function") {
      service.notifyDataChange();
    }
  } catch (error) {
    logger.warn("Failed to notify file storage change", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export default safeNotifyFileStorageChange;
