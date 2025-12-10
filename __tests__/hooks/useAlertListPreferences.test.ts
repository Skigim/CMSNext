import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";

import {
  useAlertListPreferences,
  type AlertFilters,
  type AlertSortConfig,
} from "@/hooks/useAlertListPreferences";

const STORAGE_KEY = "cmsnext-alert-list-preferences";

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

describe("useAlertListPreferences", () => {
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
      const { result } = renderHook(() => useAlertListPreferences());

      expect(result.current.sortConfig).toEqual({ key: "due", direction: "asc" });
      expect(result.current.filters).toEqual({
        searchTerm: "",
        description: "all",
        statuses: [],
        matchStatus: "all",
      });
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe("persistence", () => {
    it("saves preferences to localStorage when sortConfig changes", () => {
      const { result } = renderHook(() => useAlertListPreferences());

      const newConfig: AlertSortConfig = { key: "description", direction: "desc" };
      act(() => {
        result.current.setSortConfig(newConfig);
      });

      // Advance past debounce delay (300ms)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(stored.sortConfig).toEqual(newConfig);
    });

    it("saves preferences to localStorage when filters change", () => {
      const { result } = renderHook(() => useAlertListPreferences());

      const newFilters: AlertFilters = {
        searchTerm: "test search",
        description: "Income",
        statuses: ["in-progress", "resolved"],
        matchStatus: "matched",
      };

      act(() => {
        result.current.setFilters(newFilters);
      });

      // Advance past debounce delay (300ms)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(stored.filters.searchTerm).toBe("test search");
      expect(stored.filters.description).toBe("Income");
      expect(stored.filters.statuses).toEqual(["in-progress", "resolved"]);
      expect(stored.filters.matchStatus).toBe("matched");
    });

    it("loads preferences from localStorage on mount", () => {
      const storedPrefs = {
        sortConfig: { key: "client", direction: "desc" },
        filters: {
          searchTerm: "stored search",
          description: "Resource",
          statuses: ["new"],
          matchStatus: "unmatched",
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPrefs));

      const { result } = renderHook(() => useAlertListPreferences());

      expect(result.current.sortConfig).toEqual({ key: "client", direction: "desc" });
      expect(result.current.filters.searchTerm).toBe("stored search");
      expect(result.current.filters.description).toBe("Resource");
      expect(result.current.filters.statuses).toEqual(["new"]);
      expect(result.current.filters.matchStatus).toBe("unmatched");
    });
  });

  describe("corrupted storage fallback", () => {
    it("returns defaults when localStorage contains invalid JSON", () => {
      localStorage.setItem(STORAGE_KEY, "not valid json {{{");

      const { result } = renderHook(() => useAlertListPreferences());

      expect(result.current.sortConfig).toEqual({ key: "due", direction: "asc" });
      expect(result.current.filters).toEqual({
        searchTerm: "",
        description: "all",
        statuses: [],
        matchStatus: "all",
      });
    });

    it("returns defaults when localStorage contains non-object", () => {
      localStorage.setItem(STORAGE_KEY, '"just a string"');

      const { result } = renderHook(() => useAlertListPreferences());

      expect(result.current.sortConfig).toEqual({ key: "due", direction: "asc" });
      expect(result.current.filters.description).toBe("all");
    });

    it("handles invalid sortConfig key gracefully", () => {
      const storedPrefs = {
        sortConfig: { key: "invalid-key", direction: "asc" },
        filters: {
          searchTerm: "",
          description: "all",
          statuses: [],
          matchStatus: "all",
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPrefs));

      const { result } = renderHook(() => useAlertListPreferences());

      // Falls back to default key
      expect(result.current.sortConfig.key).toBe("due");
    });

    it("handles invalid sortConfig direction gracefully", () => {
      const storedPrefs = {
        sortConfig: { key: "client", direction: "invalid" },
        filters: {
          searchTerm: "",
          description: "all",
          statuses: [],
          matchStatus: "all",
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPrefs));

      const { result } = renderHook(() => useAlertListPreferences());

      // Falls back to default direction
      expect(result.current.sortConfig.direction).toBe("asc");
    });

    it("handles missing filters gracefully", () => {
      const storedPrefs = {
        sortConfig: { key: "description", direction: "desc" },
        // filters is missing entirely
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPrefs));

      const { result } = renderHook(() => useAlertListPreferences());

      expect(result.current.sortConfig).toEqual({ key: "description", direction: "desc" });
      expect(result.current.filters.searchTerm).toBe("");
      expect(result.current.filters.description).toBe("all");
      expect(result.current.filters.statuses).toEqual([]);
      expect(result.current.filters.matchStatus).toBe("all");
    });

    it("handles invalid matchStatus gracefully", () => {
      const storedPrefs = {
        sortConfig: { key: "due", direction: "asc" },
        filters: {
          searchTerm: "",
          description: "all",
          statuses: [],
          matchStatus: "invalid-status",
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPrefs));

      const { result } = renderHook(() => useAlertListPreferences());

      expect(result.current.filters.matchStatus).toBe("all");
    });
  });

  describe("resetPreferences", () => {
    it("resets all preferences to defaults", () => {
      const storedPrefs = {
        sortConfig: { key: "client", direction: "desc" },
        filters: {
          searchTerm: "test",
          description: "Income",
          statuses: ["resolved"],
          matchStatus: "matched",
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPrefs));

      const { result } = renderHook(() => useAlertListPreferences());

      // Verify loaded state
      expect(result.current.sortConfig.key).toBe("client");

      act(() => {
        result.current.resetPreferences();
      });

      expect(result.current.sortConfig).toEqual({ key: "due", direction: "asc" });
      expect(result.current.filters).toEqual({
        searchTerm: "",
        description: "all",
        statuses: [],
        matchStatus: "all",
      });
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("removes preferences from localStorage on reset", () => {
      const storedPrefs = {
        sortConfig: { key: "client", direction: "desc" },
        filters: {
          searchTerm: "test",
          description: "Income",
          statuses: [],
          matchStatus: "all",
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPrefs));

      const { result } = renderHook(() => useAlertListPreferences());

      act(() => {
        result.current.resetPreferences();
      });

      // The clearPreferences() call removes from localStorage
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });

  describe("convenience setters", () => {
    it("setSearchTerm updates only searchTerm in filters", () => {
      const { result } = renderHook(() => useAlertListPreferences());

      act(() => {
        result.current.setFilters({
          searchTerm: "",
          description: "Income",
          statuses: ["new"],
          matchStatus: "matched",
        });
      });

      act(() => {
        result.current.setSearchTerm("new search term");
      });

      expect(result.current.filters.searchTerm).toBe("new search term");
      expect(result.current.filters.description).toBe("Income");
      expect(result.current.filters.statuses).toEqual(["new"]);
      expect(result.current.filters.matchStatus).toBe("matched");
    });

    it("setDescription updates only description in filters", () => {
      const { result } = renderHook(() => useAlertListPreferences());

      act(() => {
        result.current.setFilters({
          searchTerm: "test",
          description: "all",
          statuses: ["resolved"],
          matchStatus: "unmatched",
        });
      });

      act(() => {
        result.current.setDescription("Resource");
      });

      expect(result.current.filters.searchTerm).toBe("test");
      expect(result.current.filters.description).toBe("Resource");
      expect(result.current.filters.statuses).toEqual(["resolved"]);
      expect(result.current.filters.matchStatus).toBe("unmatched");
    });
  });

  describe("hasActiveFilters", () => {
    it("returns false when all filters are at defaults", () => {
      const { result } = renderHook(() => useAlertListPreferences());

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it("returns true when searchTerm is set", () => {
      const { result } = renderHook(() => useAlertListPreferences());

      act(() => {
        result.current.setSearchTerm("test");
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("returns true when description is not 'all'", () => {
      const { result } = renderHook(() => useAlertListPreferences());

      act(() => {
        result.current.setDescription("Income");
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("returns true when statuses are set", () => {
      const { result } = renderHook(() => useAlertListPreferences());

      act(() => {
        result.current.setFilters({
          ...result.current.filters,
          statuses: ["new", "in-progress"],
        });
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("returns true when matchStatus is not 'all'", () => {
      const { result } = renderHook(() => useAlertListPreferences());

      act(() => {
        result.current.setFilters({
          ...result.current.filters,
          matchStatus: "matched",
        });
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it("returns false when searchTerm is only whitespace", () => {
      const { result } = renderHook(() => useAlertListPreferences());

      act(() => {
        result.current.setSearchTerm("   ");
      });

      expect(result.current.hasActiveFilters).toBe(false);
    });
  });
});
