import { useCallback, useMemo, useState } from "react";
import { createLocalStorageAdapter } from "@/utils/localStorage";
import {
  createEmptyAdvancedFilter,
  isAdvancedFilterActive,
  deserializeAdvancedFilter,
  type AdvancedAlertFilter,
  type FilterCriterion,
} from "@/domain/alerts";
import { safeNotifyFileStorageChange } from "@/utils/fileStorageNotify";
import { AdvancedAlertFilterService } from "@/utils/services/AdvancedAlertFilterService";
import { useDebouncedSave } from "./useDebouncedSave";

interface UseAdvancedAlertFilterResult {
  filter: AdvancedAlertFilter;
  addCriterion: (criterion?: FilterCriterion) => void;
  updateCriterion: (id: string, updates: Partial<Omit<FilterCriterion, "id">>) => void;
  removeCriterion: (id: string) => void;
  toggleNegate: (id: string) => void;
  setLogic: (logic: "and" | "or") => void;
  resetFilter: () => void;
  hasActiveAdvancedFilters: boolean;
}

const storage = createLocalStorageAdapter<AdvancedAlertFilter | null>(
  "cmsnext-advanced-alert-filter",
  null,
  {
    parse: deserializeAdvancedFilter,
  },
);

const advancedAlertFilterService = new AdvancedAlertFilterService();

function persistAdvancedFilter(value: AdvancedAlertFilter): void {
  storage.write(value);
  safeNotifyFileStorageChange();
}

function clearPersistedAdvancedFilter(): void {
  storage.clear();
  safeNotifyFileStorageChange();
}

export function useAdvancedAlertFilter(): UseAdvancedAlertFilterResult {
  const [filter, setFilter] = useState<AdvancedAlertFilter>(() => storage.read() ?? createEmptyAdvancedFilter());

  useDebouncedSave({
    data: filter,
    onSave: persistAdvancedFilter,
    delay: 300,
  });

  const addCriterion = useCallback((item?: FilterCriterion) => {
    setFilter((prev) => advancedAlertFilterService.addCriterion(prev, item));
  }, []);

  const updateCriterion = useCallback((id: string, updates: Partial<Omit<FilterCriterion, "id">>) => {
    setFilter((prev) => advancedAlertFilterService.updateCriterion(prev, id, updates));
  }, []);

  const removeCriterion = useCallback((id: string) => {
    setFilter((prev) => advancedAlertFilterService.removeCriterion(prev, id));
  }, []);

  const toggleNegate = useCallback((id: string) => {
    setFilter((prev) => advancedAlertFilterService.toggleNegate(prev, id));
  }, []);

  const setLogic = useCallback((logic: "and" | "or") => {
    setFilter((prev) => advancedAlertFilterService.setLogic(prev, logic));
  }, []);

  const resetFilter = useCallback(() => {
    setFilter(createEmptyAdvancedFilter());
    clearPersistedAdvancedFilter();
  }, []);

  const hasActiveAdvancedFilters = useMemo(() => isAdvancedFilterActive(filter), [filter]);

  return {
    filter,
    addCriterion,
    updateCriterion,
    removeCriterion,
    toggleNegate,
    setLogic,
    resetFilter,
    hasActiveAdvancedFilters,
  };
}
