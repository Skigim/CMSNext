import { useCallback, useMemo, useState } from "react";
import { getFileStorageFlags, updateFileStorageFlags, type CaseListViewPreference } from "@/utils/fileStorageFlags";

export type CaseListSortKey = "updated" | "name" | "mcn";
export type CaseListSegment = "all" | "recent" | "priority";

interface CaseListPreferences {
  viewMode: CaseListViewPreference;
  setViewMode: (mode: CaseListViewPreference) => void;
  sortKey: CaseListSortKey;
  setSortKey: (key: CaseListSortKey) => void;
  segment: CaseListSegment;
  setSegment: (segment: CaseListSegment) => void;
}

const DEFAULT_VIEW_MODE: CaseListViewPreference = "grid";
const DEFAULT_SORT_KEY: CaseListSortKey = "updated";
const DEFAULT_SEGMENT: CaseListSegment = "all";

export function useCaseListPreferences(): CaseListPreferences {
  const initialViewMode = useMemo<CaseListViewPreference>(() => {
    const flags = getFileStorageFlags();
    if (flags.caseListView === "grid" || flags.caseListView === "table") {
      return flags.caseListView;
    }
    return DEFAULT_VIEW_MODE;
  }, []);

  const [viewMode, setViewModeState] = useState<CaseListViewPreference>(initialViewMode);
  const [sortKey, setSortKeyState] = useState<CaseListSortKey>(DEFAULT_SORT_KEY);
  const [segment, setSegmentState] = useState<CaseListSegment>(DEFAULT_SEGMENT);

  const setViewMode = useCallback((mode: CaseListViewPreference) => {
    setViewModeState(mode);
    updateFileStorageFlags({ caseListView: mode });
  }, []);

  const setSortKey = useCallback((key: CaseListSortKey) => {
    setSortKeyState(key);
  }, []);

  const setSegment = useCallback((value: CaseListSegment) => {
    setSegmentState(value);
  }, []);

  return {
    viewMode,
    setViewMode,
    sortKey,
    setSortKey,
    segment,
    setSegment,
  };
}
