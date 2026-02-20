import {
  createEmptyFilterCriterion,
  type AdvancedAlertFilter,
  type FilterCriterion,
} from "@/domain/alerts";

export class AdvancedAlertFilterService {
  addCriterion(filter: AdvancedAlertFilter, criterion?: FilterCriterion): AdvancedAlertFilter {
    return {
      ...filter,
      criteria: [...filter.criteria, criterion ?? createEmptyFilterCriterion()],
    };
  }

  addExcludeCriterion(filter: AdvancedAlertFilter, criterion?: FilterCriterion): AdvancedAlertFilter {
    const baseCriterion = criterion ?? createEmptyFilterCriterion();
    return {
      ...filter,
      criteria: [...filter.criteria, { ...baseCriterion, negate: true }],
    };
  }

  updateCriterion(
    filter: AdvancedAlertFilter,
    id: string,
    updates: Partial<Omit<FilterCriterion, "id">>,
  ): AdvancedAlertFilter {
    return {
      ...filter,
      criteria: filter.criteria.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    };
  }

  removeCriterion(filter: AdvancedAlertFilter, id: string): AdvancedAlertFilter {
    return {
      ...filter,
      criteria: filter.criteria.filter((item) => item.id !== id),
    };
  }

  toggleNegate(filter: AdvancedAlertFilter, id: string): AdvancedAlertFilter {
    return {
      ...filter,
      criteria: filter.criteria.map((item) =>
        item.id === id ? { ...item, negate: !item.negate } : item,
      ),
    };
  }

  setLogic(filter: AdvancedAlertFilter, logic: "and" | "or"): AdvancedAlertFilter {
    return {
      ...filter,
      logic,
    };
  }
}
