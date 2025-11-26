import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoredCase, CaseStatusUpdateHandler } from "@/types/case";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";

interface UseCaseStatusMenuOptions {
  caseId: string;
  status?: StoredCase["status"];
  onUpdateStatus?: CaseStatusUpdateHandler;
}

interface UseCaseStatusMenuResult {
  status: StoredCase["status"];
  isUpdating: boolean;
  handleStatusChange: (status: StoredCase["status"]) => void;
  availableStatuses: StoredCase["status"][];
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  if (error instanceof Error) {
    return error.name === "AbortError";
  }
  if (typeof error === "object" && error !== null) {
    const maybeName = (error as { name?: string }).name;
    if (maybeName === "AbortError") {
      return true;
    }
  }
  return false;
}

/**
 * Provides optimistic case-status selection with best-effort reconciliation.
 *
 * The hook keeps three views of status in sync (external, committed, optimistic),
 * immediately reflects user choices, and gracefully reverts when the update handler
 * returns `null`, throws (sync or async), or signals cancellation via `AbortError`.
 * It also derives the available status options from the category configuration so
 * consumers never need to duplicate that knowledge.
 */
export function useCaseStatusMenu({
  caseId,
  status,
  onUpdateStatus,
}: UseCaseStatusMenuOptions): UseCaseStatusMenuResult {
  const { config } = useCategoryConfig();
  const fallbackStatus = useMemo<StoredCase["status"]>(() => {
    return (config.caseStatuses[0]?.name ?? "Pending") as StoredCase["status"];
  }, [config.caseStatuses]);

  const availableStatuses = useMemo<StoredCase["status"][]>(() => {
    const statusNames = config.caseStatuses.map(s => s.name);
    return statusNames.length > 0 ? (statusNames as StoredCase["status"][]) : [fallbackStatus];
  }, [config.caseStatuses, fallbackStatus]);

  const externalStatus = status ?? fallbackStatus;
  const externalStatusRef = useRef<StoredCase["status"]>(externalStatus);
  const committedStatusRef = useRef<StoredCase["status"]>(externalStatus);
  const [optimisticStatus, setOptimisticStatus] = useState<StoredCase["status"]>(externalStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    if (externalStatusRef.current !== externalStatus) {
      externalStatusRef.current = externalStatus;
      committedStatusRef.current = externalStatus;
      setOptimisticStatus(externalStatus);
    }
  }, [externalStatus]);

  useEffect(() => {
    isUpdatingRef.current = isUpdating;
  }, [isUpdating]);

  const handleStatusChange = useCallback(
    (nextStatus: StoredCase["status"]) => {
      if (!onUpdateStatus) {
        return;
      }

      const committedStatus = committedStatusRef.current;
      if (nextStatus === committedStatus) {
        return;
      }

      if (isUpdatingRef.current) {
        return;
      }

      setOptimisticStatus(nextStatus);
      setIsUpdating(true);

      let updatePromise: Promise<StoredCase | null | void>;
      try {
        updatePromise = Promise.resolve(onUpdateStatus(caseId, nextStatus));
      } catch (error) {
        committedStatusRef.current = committedStatus;
        setOptimisticStatus(committedStatus);
        setIsUpdating(false);
        return;
      }

      updatePromise
        .then(result => {
          if (result && typeof result === "object" && "status" in result) {
            const resolvedStatus = (result as StoredCase).status ?? nextStatus;
            committedStatusRef.current = resolvedStatus;
            setOptimisticStatus(resolvedStatus);
            return;
          }

          if (result === null) {
            committedStatusRef.current = committedStatus;
            setOptimisticStatus(committedStatus);
            return;
          }

          // Treat undefined/void as success; keep optimistic status until parent syncs.
          committedStatusRef.current = nextStatus;
        })
        .catch(error => {
          if (isAbortError(error)) {
            committedStatusRef.current = committedStatus;
            setOptimisticStatus(committedStatus);
            return;
          }

          committedStatusRef.current = committedStatus;
          setOptimisticStatus(committedStatus);
        })
        .finally(() => {
          setIsUpdating(false);
        });
    },
    [caseId, onUpdateStatus],
  );

  return {
    status: optimisticStatus,
    isUpdating,
    handleStatusChange,
    availableStatuses,
  };
}

export default useCaseStatusMenu;
