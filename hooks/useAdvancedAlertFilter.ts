import { useCallback, useMemo, useState } from "react";
import { createLocalStorageAdapter } from "@/utils/localStorage";
import {
  createEmptyAdvancedFilter,
  createEmptyFilterCriterion,
  isAdvancedFilterActive,
  deserializeAdvancedFilter,
  type AdvancedAlertFilter,
  type FilterCriterion,
} from "@/domain/alerts";
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

export function useAdvancedAlertFilter(): UseAdvancedAlertFilterResult {
  const [filter, setFilter] = useState<AdvancedAlertFilter>(() => storage.read() ?? createEmptyAdvancedFilter());

  useDebouncedSave({
    data: filter,
    onSave: (value) => storage.write(value),
    delay: 300,
  });

  const addCriterion = useCallback((item?: FilterCriterion) => {
    setFilter((prev) => ({ ...prev, criteria: [...prev.criteria, item ?? createEmptyFilterCriterion()] }));
  }, []);

  const updateCriterion = useCallback((id: string, updates: Partial<Omit<FilterCriterion, "id">>) => {
    setFilter((prev) => ({
      ...prev,
      criteria: prev.criteria.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    }));
  }, []);

  const removeCriterion = useCallback((id: string) => {
    setFilter((prev) => ({ ...prev, criteria: prev.criteria.filter((item) => item.id !== id) }));
  }, []);

  const toggleNegate = useCallback((id: string) => {
    setFilter((prev) => ({
      ...prev,
      criteria: prev.criteria.map((item) => (item.id === id ? { ...item, negate: !item.negate } : item)),
    }));
  }, []);

  const setLogic = useCallback((logic: "and" | "or") => {
    setFilter((prev) => ({ ...prev, logic }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilter(createEmptyAdvancedFilter());
    storage.clear();
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
