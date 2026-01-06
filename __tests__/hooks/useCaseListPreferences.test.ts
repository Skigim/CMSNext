import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";

import {
  useCaseListPreferences,
  type CaseFilters,
  type SortConfig,
} from "@/hooks/useCaseListPreferences";

const STORAGE_KEY = "cmsnext-case-list-preferences";

// Create a real localStorage mock that stores data
function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
}

describe("useCaseListPreferences", () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorageMock = createLocalStorageMock();
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    localStorageMock.clear();
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
        hideTerminalStatuses: false,
      });
    });
  });

  describe("persistence", () => {
    it("saves preferences to localStorage when segment changes", () => {
      const { result } = renderHook(() => useCaseListPreferences());

      act(() => {
        result.current.setSegment("recent");
      });

      // Advance past debounce delay (300ms)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(stored.segment).toBe("recent");
    });

    it("saves preferences to localStorage when sortConfigs change", () => {
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

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(stored.sortConfigs).toEqual(newConfigs);
    });

    it("saves preferences to localStorage when filters change", () => {
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
        hideTerminalStatuses: false,
      };

      act(() => {
        result.current.setFilters(newFilters);
      });

      // Advance past debounce delay (300ms)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(stored.filters.statuses).toEqual(["Pending", "Active"]);
      expect(stored.filters.priorityOnly).toBe(true);
      expect(stored.filters.dateRange.from).toBe("2025-01-01T00:00:00.000Z");
      expect(stored.filters.dateRange.to).toBe("2025-12-31T00:00:00.000Z");
    });

    it("loads preferences from localStorage on mount", () => {
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPrefs));

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
    it("returns defaults when localStorage contains invalid JSON", () => {
      localStorage.setItem(STORAGE_KEY, "not valid json {{{");

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
        hideTerminalStatuses: false,
      });
    });

    it("returns defaults when localStorage contains non-object", () => {
      localStorage.setItem(STORAGE_KEY, '"just a string"');

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPrefs));

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPrefs));

      const { result } = renderHook(() => useCaseListPreferences());

      expect(result.current.sortKey).toBe("name");
      expect(result.current.segment).toBe("recent");
      expect(result.current.filters.statuses).toEqual([]);
      expect(result.current.filters.priorityOnly).toBe(false);
    });
  });

  describe("resetPreferences", () => {
    it("resets all preferences to defaults", () => {
      const storedPrefs = {
        sortConfigs: [{ key: "name", direction: "asc" }],
        segment: "priority",
        filters: {
          statuses: ["active"],
          priorityOnly: true,
          dateRange: {},
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPrefs));

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
        hideTerminalStatuses: false,
      });
      
      // Advance past debounce delay (300ms) to allow localStorage save
      act(() => {
        vi.advanceTimersByTime(300);
      });
      
      // After reset, defaults are persisted (useEffect writes them back)
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(stored.segment).toBe("all");
      expect(stored.sortConfigs).toEqual([{ key: "name", direction: "asc" }]);
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
