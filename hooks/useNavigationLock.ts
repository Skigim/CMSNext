import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import type { FileStorageLifecycleSelectors } from "../contexts/FileStorageContext";
import { startMeasurement, endMeasurement } from "../utils/performanceTracker";

export type LockTone = "info" | "warning" | "error";

export interface NavigationLock {
  locked: boolean;
  reason: string;
  tone: LockTone;
}

interface UseNavigationLockParams {
  connectionState: FileStorageLifecycleSelectors;
}

interface UseNavigationLockResult {
  navigationLock: NavigationLock;
  /** Returns true if navigation is blocked, showing toast. Returns false if allowed. */
  guardCaseInteraction: () => boolean;
}

const NAVIGATION_TOAST_ID = "navigation-lock";

/**
 * Hook for managing navigation lock based on file storage connection state
 * 
 * Prevents case operations (create/edit/delete) when file storage is unavailable.
 * Provides computed lock state with user-friendly reason and UI tone.
 * 
 * **Lock Conditions:**
 * - BLOCKED: No folder selected (isBlocked=true)
 *   - Permission denied → tone: error, reason: \"Permission denied...\"
 *   - Other block → tone: warning, reason: \"Directory access is blocked...\"
 * - ERROR: File storage error occurred
 *   - tone: error, reason: lastError.message
 * - RECOVERING: Attempting to reconnect
 *   - tone: warning, reason: \"Reconnecting to storage...\"
 * - AWAITING CHOICE: User action needed (password, etc.)
 *   - tone: warning, reason: \"Please complete connection setup\"
 * - READY: Ready to go
 *   - tone: info, reason: \"\" (empty, not locked)
 * 
 * **Guard Function:**
 * - `guardCaseInteraction()`: Returns true if locked
 * - Shows toast with lock reason if blocked
 * - Called before case create/edit/delete operations
 * 
 * **Toast Behavior:**
 * - Shows once when lock engaged, dismisses when unlocked
 * - Uses NAVIGATION_TOAST_ID for deduplication
 * - Toast ID fixed: \"navigation-lock\" for tracking
 * 
 * **Usage Example:**
 * ```typescript
 * const { navigationLock, guardCaseInteraction } = useNavigationLock({\n *   connectionState: fileStorageState\n * });\n * 
 * // Check lock status
 * if (navigationLock.locked) {\n *   <LockedBanner\n *     reason={navigationLock.reason}\n *     tone={navigationLock.tone}\n *   />\n * }\n * \n * // Guard operations
 * async handleDelete(caseId) {\n *   if (guardCaseInteraction()) return; // Blocked
 *   await deleteCase(caseId);\n * }\n * ```
 * 
 * @param {UseNavigationLockParams} params
 *   - `connectionState`: FileStorageLifecycleSelectors for lock determination
 * 
 * @returns {UseNavigationLockResult} Lock state and guard function
 */
export function useNavigationLock({
  connectionState,
}: UseNavigationLockParams): UseNavigationLockResult {
  const {
    isReady,
    isBlocked,
    isErrored,
    isRecovering,
    isAwaitingUserChoice,
    permissionStatus,
    lastError,
  } = connectionState;

  const navigationLock = useMemo<NavigationLock>(() => {
    if (isBlocked) {
      const message =
        permissionStatus === "denied"
          ? "Permission to the data folder was denied. Reconnect to continue managing cases."
          : "Access to the data folder is blocked. Review the browser prompt and try again.";
      return { locked: true, reason: message, tone: "error" };
    }

    if (isErrored) {
      return {
        locked: true,
        reason: lastError?.message ?? "File storage encountered an unexpected error.",
        tone: "error",
      };
    }

    if (isRecovering) {
      return {
        locked: true,
        reason: "File storage is reconnecting. Case actions are temporarily paused.",
        tone: "info",
      };
    }

    if (!isReady) {
      if (isAwaitingUserChoice) {
        return {
          locked: true,
          reason: "Choose a data folder to unlock case management.",
          tone: "warning",
        };
      }

      return {
        locked: true,
        reason: "Preparing file storage. Case actions will be available shortly.",
        tone: "info",
      };
    }

    return { locked: false, reason: "", tone: "info" };
  }, [isBlocked, isErrored, isReady, isRecovering, isAwaitingUserChoice, permissionStatus, lastError]);

  // Keep ref in sync for use in callbacks
  const navigationLockedRef = useRef(navigationLock.locked);
  useEffect(() => {
    navigationLockedRef.current = navigationLock.locked;
  }, [navigationLock.locked]);

  const showNavigationLockToast = useCallback(() => {
    if (!navigationLock.locked) {
      toast.dismiss(NAVIGATION_TOAST_ID);
      return;
    }

    const toastFnMap: Record<LockTone, typeof toast.info> = {
      error: toast.error,
      warning: toast.warning,
      info: toast.info,
    };
    const toastFn = toastFnMap[navigationLock.tone] ?? toast.info;
    toastFn(navigationLock.reason, { id: NAVIGATION_TOAST_ID });
  }, [navigationLock]);

  // Show/dismiss toast when lock state changes
  useEffect(() => {
    if (navigationLock.locked) {
      showNavigationLockToast();
    } else {
      toast.dismiss(NAVIGATION_TOAST_ID);
    }
  }, [navigationLock.locked, showNavigationLockToast]);

  const guardCaseInteraction = useCallback((): boolean => {
    const locked = navigationLockedRef.current;
    startMeasurement("navigation:guard", { locked, reason: navigationLock.reason });
    if (!locked) {
      endMeasurement("navigation:guard", { locked: false });
      return false;
    }
    showNavigationLockToast();
    endMeasurement("navigation:guard", { locked: true, reason: navigationLock.reason });
    return true;
  }, [navigationLock.reason, showNavigationLockToast]);

  return {
    navigationLock,
    guardCaseInteraction,
  };
}
