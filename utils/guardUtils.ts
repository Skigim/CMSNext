import { toast } from "sonner";
import type { DataManager } from "./DataManager";

const NOT_AVAILABLE_MSG = "Data storage is not available";

/**
 * Guard function for hook operations that need DataManager.
 * Returns true if ready, false otherwise. Shows toast and sets error on failure.
 * 
 * @param manager - The DataManager instance (may be null)
 * @param setError - Optional error state setter
 * @returns true if DataManager is available, false otherwise
 */
export function guardDataManager(
  manager: DataManager | null,
  setError?: (error: string | null) => void
): manager is DataManager {
  if (!manager) {
    setError?.(NOT_AVAILABLE_MSG);
    toast.error(NOT_AVAILABLE_MSG);
    return false;
  }
  return true;
}
