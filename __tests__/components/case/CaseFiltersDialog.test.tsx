import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaseFiltersDialog } from "@/components/case/CaseFiltersDialog";
import { createEmptyAdvancedFilter } from "@/domain/alerts";
import type { UseAdvancedAlertFilterResult } from "@/hooks/useAdvancedAlertFilter";
import type { CaseFilters } from "@/hooks/useCaseListPreferences";

vi.mock("@/contexts/CategoryConfigContext", () => ({
  useCategoryConfig: () => ({
    config: {
      caseStatuses: [{ name: "Pending" }, { name: "Approved" }],
    },
  }),
}));

vi.mock("@/hooks/useAppViewState", () => ({
  useAppViewState: () => ({
    featureFlags: {},
  }),
}));

const advancedAlertFilterState: UseAdvancedAlertFilterResult = {
  filter: createEmptyAdvancedFilter(),
  includeCriteria: [],
  excludeCriteria: [],
  addCriterion: vi.fn(),
  addExcludeCriterion: vi.fn(),
  updateCriterion: vi.fn(),
  removeCriterion: vi.fn(),
  toggleNegate: vi.fn(),
  setLogic: vi.fn(),
  resetFilter: vi.fn(),
  hasActiveAdvancedFilters: false,
};

const filters: CaseFilters = {
  statuses: [],
  priorityOnly: false,
  dateRange: {},
  excludeStatuses: [],
  excludePriority: false,
  alertDescription: "all",
  showCompleted: true,
};

describe("CaseFiltersDialog", () => {
  it("provides an accessible dialog description", () => {
    render(
      <CaseFiltersDialog
        open={true}
        onOpenChange={vi.fn()}
        filters={filters}
        onFiltersChange={vi.fn()}
        advancedAlertFilterState={advancedAlertFilterState}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Filter cases" })).toHaveAccessibleDescription(
      "Narrow the case list by status, priority, date range, completion state, and alert filters.",
    );
  });
});