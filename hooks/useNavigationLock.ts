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
 * Manages navigation lock state based on file storage connection status.
 * 
 * Provides:
 * - Computed lock state with reason and tone
 * - Guard function to block case interactions when locked
 * - Automatic toast notifications for lock state changes
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
