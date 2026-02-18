import { useEffect, useMemo, useRef } from "react";
import { useFileStorage } from "@/contexts/FileStorageContext";
import { recordAutosaveStateTransition } from "@/utils/telemetryInstrumentation";
import { formatRelativeTime } from "@/utils/formatFreshness";
import type {
  FileStorageLifecycleState,
  FileStoragePermissionState,
} from "@/contexts/FileStorageContext";

/**
 * Autosave status states - represents the current save operation state.
 * @typedef {'saving' | 'saved' | 'permission-required' | 'retrying' | 'error' | 'idle' | 'unsupported'} AutosaveStatusState
 */
export type AutosaveStatusState =
  | "saving"
  | "saved"
  | "permission-required"
  | "retrying"
  | "error"
  | "idle"
  | "unsupported";

/**
 * Tone for UI styling - maps status to color/severity.
 * @typedef {'success' | 'warning' | 'danger' | 'info' | 'muted'} AutosaveTone
 */
type AutosaveTone = "success" | "warning" | "danger" | "info" | "muted";

/**
 * Autosave status summary with display-ready text and state.
 * @interface AutosaveStatusSummary
 */
export interface AutosaveStatusSummary {
  /** Current save operation state */
  state: AutosaveStatusState;
  /** Human-readable status label (e.g., "Saving...", "All changes saved") */
  displayLabel: string;
  /** Detailed description for UI display */
  detailText: string;
  /** Timestamp of last successful save (milliseconds since epoch) */
  lastSavedAt: number | null;
  /** Human-readable relative time of last save (e.g., "2min ago") */
  lastSavedRelative: string | null;
  /** Number of writes waiting to be saved */
  pendingWrites: number;
  /** Number of consecutive failed save attempts */
  consecutiveFailures: number;
  /** Current permission status for file access */
  permissionStatus: FileStoragePermissionState;
  /** Current lifecycle state of file storage */
  lifecycle: FileStorageLifecycleState;
  /** Raw status string from autosave service */
  rawStatus: string;
  /** Optional error or status message from service */
  message: string | null;
  /** Whether currently in save operation */
  isSaving: boolean;
  /** Whether to show loading spinner in UI */
  showSpinner: boolean;
  /** UI tone/severity (success, warning, danger, info, muted) */
  tone: AutosaveTone;
}

interface StatusDisplayInfo {
  state: AutosaveStatusState;
  displayLabel: string;
  detailText: string;
  tone: AutosaveTone;
  showSpinner: boolean;
}

/** Append pending-writes description if available. */
function withPending(text: string, pending: string | null): string {
  return pending ? `${text} (${pending})` : text;
}

interface DeriveStatusDisplayOptions {
  rawStatus: string;
  message: string | null;
  pendingDescription: string | null;
  consecutiveFailures: number;
  lastSavedAt: number | null;
  lastSavedRelative: string | null;
  isSupported: boolean | undefined;
  lifecycle: FileStorageLifecycleState;
  permissionStatus: FileStoragePermissionState;
}

/** Map raw service inputs to display properties. */
function deriveStatusDisplay({
  rawStatus,
  message,
  pendingDescription,
  consecutiveFailures,
  lastSavedAt,
  lastSavedRelative,
  isSupported,
  lifecycle,
  permissionStatus,
}: DeriveStatusDisplayOptions): StatusDisplayInfo {
  const defaultDetail = message ?? (lastSavedRelative ? `Last saved ${lastSavedRelative}` : "Autosave is standing by.");

  if (isSupported === false) {
    return { state: "unsupported", displayLabel: "Not available", detailText: "File System Access API is not supported in this browser.", tone: "muted", showSpinner: false };
  }
  if (lifecycle === "error" || rawStatus === "error") {
    return { state: "error", displayLabel: "Save failed", detailText: withPending(message ?? "Autosave encountered an error.", pendingDescription), tone: "danger", showSpinner: false };
  }
  if (permissionStatus !== "granted" || rawStatus === "waiting") {
    return { state: "permission-required", displayLabel: "Permission required", detailText: withPending(message ?? "Allow folder access to resume autosave.", pendingDescription), tone: "warning", showSpinner: false };
  }
  if (rawStatus === "retrying") {
    return { state: "retrying", displayLabel: "Retrying save…", detailText: withPending(message ?? `Autosave retrying (attempt ${consecutiveFailures + 1})`, pendingDescription), tone: "warning", showSpinner: true };
  }
  if (rawStatus === "saving" || (pendingDescription !== null)) {
    return { state: "saving", displayLabel: "Saving…", detailText: withPending(message ?? "Writing changes to your folder…", pendingDescription), tone: "info", showSpinner: true };
  }
  if (lastSavedAt) {
    return { state: "saved", displayLabel: "All changes saved", detailText: lastSavedRelative ? `Last saved ${lastSavedRelative}` : "Last save completed successfully.", tone: "success", showSpinner: false };
  }
  return { state: "idle", displayLabel: message ?? "Autosave ready", detailText: withPending(defaultDetail, pendingDescription), tone: "muted", showSpinner: false };
}

function describePendingWrites(pendingWrites: number): string | null {
  if (pendingWrites <= 0) {
    return null;
  }

  if (pendingWrites === 1) {
    return "1 pending write";
  }

  return `${pendingWrites} pending writes`;
}

/**
 * Autosave status summary hook.
 * 
 * Provides human-readable status information about autosave operations.
 * Derives display text, icons, and UI state from raw autosave metrics.
 * 
 * ## Status States
 * 
 * - **saving**: Currently writing changes to file
 * - **saved**: All changes saved, standing by
 * - **retrying**: Previous save failed, retrying
 * - **error**: Save operation failed, user action needed
 * - **permission-required**: Need folder access permission
 * - **idle**: Autosave disabled or not yet started
 * - **unsupported**: File System Access API not available in browser
 * 
 * ## Display Properties
 * 
 * All properties are computed from autosave service state and ready for UI:
 * - `displayLabel`: Short status text ("Saving...", "All changes saved")
 * - `detailText`: Longer explanation for status bar or tooltip
 * - `tone`: Color/severity indicator (success, warning, danger, info, muted)
 * - `showSpinner`: Whether to show loading animation
 * 
 * ## Time Formatting
 * 
 * Relative timestamps are automatically formatted:
 * - `< 10s`: "just now"
 * - `< 60s`: "45s ago"
 * - `< 60m`: "12min ago"
 * - `< 24h`: "2h ago"
 * - `< 7d`: "3d ago"
 * - `>= 7d`: Full date (e.g., "12/29/2025")
 * 
 * ## Usage in Status Bar
 * 
 * ```typescript
 * function AutosaveStatusDisplay() {
 *   const {
 *     state,
 *     displayLabel,
 *     detailText,
 *     tone,
 *     showSpinner
 *   } = useAutosaveStatus();
 *   
 *   return (
 *     <div className={`status-${tone}`}>
 *       {showSpinner && <Spinner />}
 *       <strong>{displayLabel}</strong>
 *       <p>{detailText}</p>
 *     </div>
 *   );
 * }
 * ```
 * 
 * ## Error Handling Display
 * 
 * When errors occur, shows both the error and pending write count:
 * 
 * ```
 * Save failed
 * Autosave encountered an error. (3 pending writes)
 * ```
 * 
 * ## Permission Flow
 * 
 * When permission is required:
 * 
 * ```
 * Permission required
 * Allow folder access to resume autosave. (5 pending writes)
 * ```
 * 
 * ## Architecture
 * 
 * ```
 * useAutosaveStatus
 *     ↓
 * useFileStorage (raw status)
 *     ↓
 * useMemo (format for display)
 * ```
 * 
 * @hook
 * @returns {AutosaveStatusSummary} Formatted status with display properties
 * 
 * @see {@link useFileStorage} for raw autosave status
 * @see {@link FileStorageContext} for underlying service
 */
export function useAutosaveStatus(): AutosaveStatusSummary {
  const { status: statusSnapshot, lifecycle, permissionStatus, isSupported } = useFileStorage();
  const previousStateRef = useRef<AutosaveStatusState>("idle");

  const result = useMemo(() => {
    const rawStatus = statusSnapshot?.status ?? "unknown";
    const pendingWrites = statusSnapshot?.pendingWrites ?? 0;
    const consecutiveFailures = statusSnapshot?.consecutiveFailures ?? 0;
    const lastSavedAt = statusSnapshot?.lastSaveTime ?? null;
    const lastSavedRelative = formatRelativeTime(lastSavedAt);
    const message = statusSnapshot?.message ?? null;
    const pendingDescription = describePendingWrites(pendingWrites);

    const { state, displayLabel, detailText, tone, showSpinner } = deriveStatusDisplay({
      rawStatus, message, pendingDescription, consecutiveFailures,
      lastSavedAt, lastSavedRelative, isSupported, lifecycle, permissionStatus,
    });

    return {
      state,
      displayLabel,
      detailText,
      lastSavedAt,
      lastSavedRelative,
      pendingWrites,
      consecutiveFailures,
      permissionStatus,
      lifecycle,
      rawStatus,
      message,
      isSaving: state === "saving" || state === "retrying",
      showSpinner,
      tone,
    } satisfies AutosaveStatusSummary;
  }, [
    statusSnapshot,
    lifecycle,
    permissionStatus,
    isSupported,
  ]);

  // Track state transitions for telemetry in useEffect
  useEffect(() => {
    if (previousStateRef.current !== result.state) {
      recordAutosaveStateTransition(previousStateRef.current, result.state, {
        metadata: {
          permissionStatus: result.permissionStatus,
          rawStatus: result.rawStatus,
          consecutiveFailures: result.consecutiveFailures,
          pendingWrites: result.pendingWrites,
        },
      });
      previousStateRef.current = result.state;
    }
  }, [result]);

  return result;
}
