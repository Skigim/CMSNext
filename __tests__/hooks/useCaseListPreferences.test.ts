import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";

import {
  useCaseListPreferences,
  type CaseFilters,
  type SortConfig,
} from "@/hooks/useCaseListPreferences";

// Use vi.hoisted() to properly hoist mock functions before vi.mock
const { mockRead, mockWrite, mockClear } = vi.hoisted(() => ({
  mockRead: vi.fn(),
  mockWrite: vi.fn(),
  mockClear: vi.fn(),
}));

// Mock the localStorage adapter module
vi.mock("@/utils/localStorage", () => ({
  createLocalStorageAdapter: vi.fn(() => ({
    key: "cmsnext-case-list-preferences",
    read: mockRead,
    write: mockWrite,
    clear: mockClear,
  })),
  hasLocalStorage: vi.fn(() => true),
}));

describe("useCaseListPreferences", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset mock implementations for each test
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

  describe("default values", () => {
    it("returns default preferences when localStorage is empty", () => {
      const { result } = renderHook(() => useCaseListPreferences());

      expect(result.current.sortKey).toBe("name");
      expect(result.current.sortDirection).toBe("asc");
      expect(result.current.segment).toBe("all");
      expect(result.current.sortConfigs).toEqual([{ key: "name", direction: "asc" }]);
      expect(result.current.filters).toEqual({
        statuses: [],
        priorityOnly: false,
        dateRange: {},
        excludeStatuses: [],
        excludePriority: false,
        alertDescription: "all",
        showCompleted: true,
      });
    });
  });

  describe("persistence", () => {
    it("saves preferences to storage when segment changes", () => {
      const { result } = renderHook(() => useCaseListPreferences());

      act(() => {
        result.current.setSegment("recent");
      });

      // Advance past debounce delay (300ms)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockWrite).toHaveBeenCalled();
      const savedData = mockWrite.mock.calls[0][0];
      expect(savedData.segment).toBe("recent");
    });

    it("saves preferences to storage when sortConfigs change", () => {
      const { result } = renderHook(() => useCaseListPreferences());

      const newConfigs: SortConfig[] = [
        { key: "name", direction: "asc" },
        { key: "status", direction: "desc" },
      ];

      act(() => {
        result.current.setSortConfigs(newConfigs);
      });

      // Advance past debounce delay (300ms)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockWrite).toHaveBeenCalled();
      const savedData = mockWrite.mock.calls[0][0];
      expect(savedData.sortConfigs).toEqual(newConfigs);
    });

    it("saves preferences to storage when filters change", () => {
      const { result } = renderHook(() => useCaseListPreferences());

      const newFilters: CaseFilters = {
        statuses: ["Pending", "Active"],
        priorityOnly: true,
        dateRange: {
          from: new Date("2025-01-01"),
          to: new Date("2025-12-31"),
        },
        excludeStatuses: [],
        excludePriority: false,
        alertDescription: "all",
        showCompleted: true,
      };

      act(() => {
        result.current.setFilters(newFilters);
      });

      // Advance past debounce delay (300ms)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockWrite).toHaveBeenCalled();
      const savedData = mockWrite.mock.calls[0][0];
      expect(savedData.filters.statuses).toEqual(["Pending", "Active"]);
      expect(savedData.filters.priorityOnly).toBe(true);
      expect(savedData.filters.dateRange.from).toBe("2025-01-01T00:00:00.000Z");
      expect(savedData.filters.dateRange.to).toBe("2025-12-31T00:00:00.000Z");
    });

    it("loads preferences from storage on mount", () => {
      const storedPrefs = {
        sortConfigs: [{ key: "name", direction: "asc" }],
        segment: "priority",
        filters: {
          statuses: ["active"],
          priorityOnly: true,
          dateRange: {
            from: "2025-06-01T00:00:00.000Z",
            to: "2025-06-30T00:00:00.000Z",
          },
        },
      };
      mockRead.mockReturnValue(storedPrefs);

      const { result } = renderHook(() => useCaseListPreferences());

      expect(result.current.sortKey).toBe("name");
      expect(result.current.sortDirection).toBe("asc");
      expect(result.current.segment).toBe("priority");
      expect(result.current.sortConfigs).toEqual([{ key: "name", direction: "asc" }]);
      expect(result.current.filters.statuses).toEqual(["active"]);
      expect(result.current.filters.priorityOnly).toBe(true);
      expect(result.current.filters.dateRange.from).toEqual(new Date("2025-06-01T00:00:00.000Z"));
      expect(result.current.filters.dateRange.to).toEqual(new Date("2025-06-30T00:00:00.000Z"));
    });
  });

  describe("corrupted storage fallback", () => {
    it("returns defaults when storage returns null (parsing fails)", () => {
      // The adapter's custom parse function returns null for invalid JSON
      mockRead.mockReturnValue(null);

      const { result } = renderHook(() => useCaseListPreferences());

      // Default sort is now alphabetical (name asc)
      expect(result.current.sortKey).toBe("name");
      expect(result.current.segment).toBe("all");
      expect(result.current.filters).toEqual({
        statuses: [],
        priorityOnly: false,
        dateRange: {},
        excludeStatuses: [],
        excludePriority: false,
        alertDescription: "all",
        showCompleted: true,
      });
    });

    it("returns defaults when storage returns non-object", () => {
      // Simulates returning a primitive instead of object
      mockRead.mockReturnValue(null);

      const { result } = renderHook(() => useCaseListPreferences());

      // Default sort is now alphabetical (name asc)
      expect(result.current.sortKey).toBe("name");
      expect(result.current.segment).toBe("all");
    });

    it("handles invalid date strings gracefully", () => {
      const storedPrefs = {
        sortConfigs: [{ key: "updated", direction: "desc" }],
        segment: "all",
        filters: {
          statuses: [],
          priorityOnly: false,
          dateRange: {
            from: "not-a-date",
            to: "also-not-a-date",
          },
        },
      };
      mockRead.mockReturnValue(storedPrefs);

      const { result } = renderHook(() => useCaseListPreferences());

      expect(result.current.filters.dateRange.from).toBeUndefined();
      expect(result.current.filters.dateRange.to).toBeUndefined();
    });

    it("handles missing filters gracefully", () => {
      const storedPrefs = {
        sortConfigs: [{ key: "name", direction: "asc" }],
        segment: "recent",
        // filters is missing entirely
      };
      mockRead.mockReturnValue(storedPrefs);

      const { result } = renderHook(() => useCaseListPreferences());

      expect(result.current.sortKey).toBe("name");
      expect(result.current.segment).toBe("recent");
      expect(result.current.filters.statuses).toEqual([]);
      expect(result.current.filters.priorityOnly).toBe(false);
    });
  });

  describe("resetPreferences", () => {
    it("resets all preferences to defaults and clears storage", () => {
      const storedPrefs = {
        sortConfigs: [{ key: "name", direction: "asc" }],
        segment: "priority",
        filters: {
          statuses: ["active"],
          priorityOnly: true,
          dateRange: {},
        },
      };
      mockRead.mockReturnValue(storedPrefs);

      const { result } = renderHook(() => useCaseListPreferences());

      // Verify loaded state
      expect(result.current.segment).toBe("priority");

      act(() => {
        result.current.resetPreferences();
      });

      expect(result.current.sortKey).toBe("name");
      expect(result.current.sortDirection).toBe("asc");
      expect(result.current.segment).toBe("all");
      expect(result.current.sortConfigs).toEqual([{ key: "name", direction: "asc" }]);
      expect(result.current.filters).toEqual({
        statuses: [],
        priorityOnly: false,
        dateRange: {},
        excludeStatuses: [],
        excludePriority: false,
        alertDescription: "all",
        showCompleted: true,
      });
      
      // Verify storage.clear was called
      expect(mockClear).toHaveBeenCalled();
      
      // Advance past debounce delay (300ms) to allow storage save
      act(() => {
        vi.advanceTimersByTime(300);
      });
      
      // After reset, defaults are persisted (useEffect writes them back)
      expect(mockWrite).toHaveBeenCalled();
      const savedData = mockWrite.mock.calls[0][0];
      expect(savedData.segment).toBe("all");
      expect(savedData.sortConfigs).toEqual([{ key: "name", direction: "asc" }]);
    });
  });

  describe("sort key and direction sync", () => {
    it("updates sortConfigs when setSortKey is called", () => {
      const { result } = renderHook(() => useCaseListPreferences());

      act(() => {
        result.current.setSortKey("name");
      });

      expect(result.current.sortKey).toBe("name");
      expect(result.current.sortConfigs[0].key).toBe("name");
    });

    it("updates sortConfigs when setSortDirection is called", () => {
      const { result } = renderHook(() => useCaseListPreferences());

      act(() => {
        result.current.setSortDirection("asc");
      });

      expect(result.current.sortDirection).toBe("asc");
      expect(result.current.sortConfigs[0].direction).toBe("asc");
    });

    it("updates sortKey and sortDirection when setSortConfigs is called", () => {
      const { result } = renderHook(() => useCaseListPreferences());

      act(() => {
        result.current.setSortConfigs([
          { key: "mcn", direction: "asc" },
          { key: "status", direction: "desc" },
        ]);
      });

      expect(result.current.sortKey).toBe("mcn");
      expect(result.current.sortDirection).toBe("asc");
    });
  });
});
