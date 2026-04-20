import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { CaseFiltersDialog } from "@/components/case/CaseFiltersDialog";
import { createEmptyAdvancedFilter } from "@/domain/alerts";
import type { FilterCriterion } from "@/domain/alerts";
import type { UseAdvancedAlertFilterResult } from "@/hooks/useAdvancedAlertFilter";
import type { CaseFilters } from "@/hooks/useCaseListPreferences";

expect.extend(toHaveNoViolations);

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

const filters: CaseFilters = {
  statuses: [],
  priorityOnly: false,
  dateRange: {},
  excludeStatuses: [],
  excludePriority: false,
  alertDescription: "all",
  showCompleted: true,
};

function createAdvancedAlertFilterState(
  overrides: Partial<UseAdvancedAlertFilterResult> = {},
): UseAdvancedAlertFilterResult {
  return {
    filter: createEmptyAdvancedFilter(),
    includeCriteria: [],
    excludeCriteria: [],
    addCriterion: vi.fn<(criterion?: FilterCriterion) => void>(),
    addExcludeCriterion: vi.fn<(criterion?: FilterCriterion) => void>(),
    updateCriterion: vi.fn<
      (id: string, updates: Partial<Omit<FilterCriterion, "id">>) => void
    >(),
    removeCriterion: vi.fn<(id: string) => void>(),
    toggleNegate: vi.fn<(id: string) => void>(),
    setLogic: vi.fn<(logic: "and" | "or") => void>(),
    resetFilter: vi.fn<() => void>(),
    hasActiveAdvancedFilters: false,
    ...overrides,
  };
}

describe("CaseFiltersDialog", () => {
  it("provides an accessible dialog description", async () => {
    // Arrange
    const { container } = render(
      <CaseFiltersDialog
        open={true}
        onOpenChange={vi.fn()}
        filters={filters}
        onFiltersChange={vi.fn()}
        advancedAlertFilterState={createAdvancedAlertFilterState()}
      />,
    );

    // Act
    const results = await axe(container);

    // Assert
    expect(results).toHaveNoViolations();
    expect(screen.getByRole("dialog", { name: "Filter cases" })).toHaveAccessibleDescription(
      "Narrow the case list by status, priority, date range, completion state, and alert filters.",
    );
  });

  it("clears stale alert description filters when the available descriptions disappear", () => {
    // ARRANGE
    const onFiltersChange = vi.fn();
    const advancedState = createAdvancedAlertFilterState({
      filter: {
        logic: "and",
        criteria: [
          {
            id: "criterion-1",
            field: "description",
            operator: "equals",
            value: ["Court Notice"],
            negate: false,
          },
        ],
      },
      hasActiveAdvancedFilters: true,
    });

    const { rerender } = render(
      <CaseFiltersDialog
        open={false}
        onOpenChange={vi.fn()}
        filters={{ ...filters, alertDescription: "Court Notice" }}
        onFiltersChange={onFiltersChange}
        segment="alerts"
        alertDescriptions={["Court Notice"]}
        advancedAlertFilterState={advancedState}
      />,
    );

    // ACT
    rerender(
      <CaseFiltersDialog
        open={false}
        onOpenChange={vi.fn()}
        filters={{ ...filters, alertDescription: "Court Notice" }}
        onFiltersChange={onFiltersChange}
        segment="alerts"
        alertDescriptions={[]}
        advancedAlertFilterState={advancedState}
      />,
    );

    // ASSERT
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...filters,
      alertDescription: "all",
    });
    expect(advancedState.removeCriterion).toHaveBeenCalledWith("criterion-1");
  });
});