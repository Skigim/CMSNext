import { useMemo, useRef } from "react";
import { useFileStorage } from "@/contexts/FileStorageContext";
import { recordAutosaveStateTransition } from "@/utils/telemetryInstrumentation";
import type {
  FileStorageLifecycleState,
  FileStoragePermissionState,
} from "@/contexts/FileStorageContext";

export type AutosaveStatusState =
  | "saving"
  | "saved"
  | "permission-required"
  | "retrying"
  | "error"
  | "idle"
  | "unsupported";

type AutosaveTone = "success" | "warning" | "danger" | "info" | "muted";

export interface AutosaveStatusSummary {
  state: AutosaveStatusState;
  displayLabel: string;
  detailText: string;
  lastSavedAt: number | null;
  lastSavedRelative: string | null;
  pendingWrites: number;
  consecutiveFailures: number;
  permissionStatus: FileStoragePermissionState;
  lifecycle: FileStorageLifecycleState;
  rawStatus: string;
  message: string | null;
  isSaving: boolean;
  showSpinner: boolean;
  tone: AutosaveTone;
}

function formatRelativeTime(timestamp: number | null): string | null {
  if (!timestamp) {
    return null;
  }

  const diffMs = Date.now() - timestamp;
  const diffSeconds = Math.round(diffMs / 1000);

  if (diffSeconds < 10) {
    return "just now";
  }

  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return new Date(timestamp).toLocaleDateString();
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

    let state: AutosaveStatusState = "idle";
    let displayLabel = "Autosave ready";
    let detailText =
      message ??
      (lastSavedRelative ? `Last saved ${lastSavedRelative}` : "Autosave is standing by.");
    let tone: AutosaveTone = "muted";
    let showSpinner = false;

    if (isSupported === false) {
      state = "unsupported";
      displayLabel = "Not available";
      detailText = "File System Access API is not supported in this browser.";
      tone = "muted";
    } else if (lifecycle === "error" || rawStatus === "error") {
      state = "error";
      displayLabel = "Save failed";
      detailText = message ?? "Autosave encountered an error.";
      if (pendingDescription) {
        detailText += ` (${pendingDescription})`;
      }
      tone = "danger";
    } else if (permissionStatus !== "granted" || rawStatus === "waiting") {
      state = "permission-required";
      displayLabel = "Permission required";
      detailText = message ?? "Allow folder access to resume autosave.";
      if (pendingDescription) {
        detailText += ` (${pendingDescription})`;
      }
      tone = "warning";
    } else if (rawStatus === "retrying") {
      state = "retrying";
      displayLabel = "Retrying save…";
      detailText =
  message ??
  `Autosave retrying (attempt ${consecutiveFailures + 1})`;
      if (pendingDescription) {
        detailText += ` (${pendingDescription})`;
      }
      tone = "warning";
      showSpinner = true;
    } else if (rawStatus === "saving" || pendingWrites > 0) {
      state = "saving";
      displayLabel = "Saving…";
      detailText = message ?? "Writing changes to your folder…";
      if (pendingDescription) {
        detailText += ` (${pendingDescription})`;
      }
      tone = "info";
      showSpinner = true;
    } else if (lastSavedAt) {
      state = "saved";
      displayLabel = "All changes saved";
      detailText = lastSavedRelative
        ? `Last saved ${lastSavedRelative}`
        : "Last save completed successfully.";
      tone = "success";
    } else {
      state = "idle";
      displayLabel = message ?? "Autosave ready";
      detailText = message ?? "Autosave is standing by.";
      if (pendingDescription) {
        detailText += ` (${pendingDescription})`;
      }
      tone = "muted";
    }

    // Track state transition for telemetry
    if (previousStateRef.current !== state) {
      recordAutosaveStateTransition(previousStateRef.current, state, {
        metadata: {
          permissionStatus,
          rawStatus,
          consecutiveFailures,
          pendingWrites,
        },
      });
      previousStateRef.current = state;
    }

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

  return result;
}
