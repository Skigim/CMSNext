import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAdvancedAlertFilter,
} from "@/hooks/useAdvancedAlertFilter";
import type { AdvancedAlertFilter, FilterCriterion } from "@/domain/alerts";

const { mockRead, mockWrite, mockClear } = vi.hoisted(() => ({
  mockRead: vi.fn(),
  mockWrite: vi.fn(),
  mockClear: vi.fn(),
}));

vi.mock("@/utils/localStorage", () => ({
  createLocalStorageAdapter: vi.fn(() => ({
    read: mockRead,
    write: mockWrite,
    clear: mockClear,
  })),
  hasLocalStorage: vi.fn(() => true),
}));

describe("useAdvancedAlertFilter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRead.mockReset();
    mockWrite.mockReset();
    mockClear.mockReset();
    mockRead.mockReturnValue(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("loads default state when storage is empty", () => {
    const { result } = renderHook(() => useAdvancedAlertFilter());

    expect(result.current.filter.logic).toBe("and");
    expect(result.current.filter.criteria).toEqual([]);
    expect(result.current.hasActiveAdvancedFilters).toBe(false);
  });

  it("loads persisted valid filter on mount", () => {
    const stored: AdvancedAlertFilter = {
      logic: "or",
      criteria: [
        {
          id: "c1",
          field: "status",
          operator: "equals",
          value: "new",
          negate: false,
        },
      ],
    };
    mockRead.mockReturnValue(stored);

    const { result } = renderHook(() => useAdvancedAlertFilter());

    expect(result.current.filter).toEqual(stored);
    expect(result.current.hasActiveAdvancedFilters).toBe(true);
  });

  it("adds, updates, toggles, and removes criteria", () => {
    const { result } = renderHook(() => useAdvancedAlertFilter());

    const customCriterion: FilterCriterion = {
      id: "custom-1",
      field: "description",
      operator: "contains",
      value: "AVS",
      negate: false,
    };

    act(() => {
      result.current.addCriterion(customCriterion);
    });

    expect(result.current.filter.criteria).toHaveLength(1);
    expect(result.current.filter.criteria[0]).toEqual(customCriterion);

    act(() => {
      result.current.updateCriterion("custom-1", { operator: "not-contains", value: "mail" });
    });

    expect(result.current.filter.criteria[0].operator).toBe("not-contains");
    expect(result.current.filter.criteria[0].value).toBe("mail");

    act(() => {
      result.current.toggleNegate("custom-1");
    });

    expect(result.current.filter.criteria[0].negate).toBe(true);

    act(() => {
      result.current.removeCriterion("custom-1");
    });

    expect(result.current.filter.criteria).toHaveLength(0);
  });

  it("sets top-level logic", () => {
    const { result } = renderHook(() => useAdvancedAlertFilter());

    act(() => {
      result.current.setLogic("or");
    });

    expect(result.current.filter.logic).toBe("or");
  });

  it("persists updates with debounce", () => {
    const { result } = renderHook(() => useAdvancedAlertFilter());

    act(() => {
      result.current.addCriterion({
        id: "c1",
        field: "description",
        operator: "contains",
        value: "AVS",
        negate: false,
      });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        logic: "and",
        criteria: expect.arrayContaining([
          expect.objectContaining({ id: "c1", field: "description" }),
        ]),
      }),
    );
  });

  it("resets filter and clears storage", () => {
    const stored: AdvancedAlertFilter = {
      logic: "and",
      criteria: [
        {
          id: "c1",
          field: "status",
          operator: "equals",
          value: "new",
          negate: false,
        },
      ],
    };
    mockRead.mockReturnValue(stored);

    const { result } = renderHook(() => useAdvancedAlertFilter());

    act(() => {
      result.current.resetFilter();
    });

    expect(result.current.filter.criteria).toEqual([]);
    expect(result.current.filter.logic).toBe("and");
    expect(result.current.hasActiveAdvancedFilters).toBe(false);
    expect(mockClear).toHaveBeenCalled();
  });
});
