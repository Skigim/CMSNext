import type { DataManager } from "./DataManager";
import type { NormalizedFileData } from "./services/FileStorageService";

/**
 * Asserts that the DataManager instance (and its loaded data) are available.
 * Throws with a contextual message when unavailable.
 */
export function assertDataManagerReady(
  manager: DataManager | null,
  context: string
): asserts manager is DataManager & { data: NormalizedFileData } {
  const hasData = (manager as { data?: NormalizedFileData } | null)?.data;
  if (!manager || !hasData) {
    throw new Error(`${context}: DataManager data is not available`);
  }
}

/**
 * Returns a zero-arg guard that closes over the provided manager/context.
 */
export function createDataManagerGuard(manager: DataManager | null, context: string) {
  return () => assertDataManagerReady(manager, context);
}
