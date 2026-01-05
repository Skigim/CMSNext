import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { useRecentCases } from "@/hooks/useRecentCases";

const STORAGE_KEY = "cmsnext-recent-cases";

function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
}

describe("useRecentCases", () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    localStorageMock = createLocalStorageMock();
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe("initial state", () => {
    it("returns empty array when localStorage is empty", () => {
      const { result } = renderHook(() => useRecentCases());
      expect(result.current.recentCaseIds).toEqual([]);
    });

    it("loads existing entries from localStorage", () => {
      const existingEntries = [
        { caseId: "case-1", viewedAt: "2024-01-15T10:00:00.000Z" },
        { caseId: "case-2", viewedAt: "2024-01-15T09:00:00.000Z" },
      ];
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(existingEntries));

      const { result } = renderHook(() => useRecentCases());
      expect(result.current.recentCaseIds).toEqual(["case-1", "case-2"]);
    });

    it("handles corrupted localStorage data gracefully", () => {
      localStorageMock.setItem(STORAGE_KEY, "invalid-json{");

      const { result } = renderHook(() => useRecentCases());
      expect(result.current.recentCaseIds).toEqual([]);
    });
  });

  describe("addToRecent", () => {
    it("adds a case to the recent list", () => {
      const { result } = renderHook(() => useRecentCases());

      act(() => {
        result.current.addToRecent("case-1");
      });

      expect(result.current.recentCaseIds).toContain("case-1");
    });

    it("moves existing case to front when added again", () => {
      const { result } = renderHook(() => useRecentCases());

      act(() => {
        result.current.addToRecent("case-1");
        result.current.addToRecent("case-2");
        result.current.addToRecent("case-1");
      });

      expect(result.current.recentCaseIds).toEqual(["case-1", "case-2"]);
    });

    it("persists to localStorage", () => {
      const { result } = renderHook(() => useRecentCases());

      act(() => {
        result.current.addToRecent("case-1");
      });

      const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) || "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0].caseId).toBe("case-1");
    });

    it("respects max entries limit of 10", () => {
      const { result } = renderHook(() => useRecentCases());

      act(() => {
        for (let i = 1; i <= 12; i++) {
          result.current.addToRecent(`case-${i}`);
        }
      });

      expect(result.current.recentCaseIds).toHaveLength(10);
      expect(result.current.recentCaseIds[0]).toBe("case-12");
      expect(result.current.recentCaseIds).not.toContain("case-1");
      expect(result.current.recentCaseIds).not.toContain("case-2");
    });
  });

  describe("removeFromRecent", () => {
    it("removes a case from the recent list", () => {
      const existingEntries = [
        { caseId: "case-1", viewedAt: "2024-01-15T10:00:00.000Z" },
        { caseId: "case-2", viewedAt: "2024-01-15T09:00:00.000Z" },
      ];
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(existingEntries));

      const { result } = renderHook(() => useRecentCases());

      act(() => {
        result.current.removeFromRecent("case-1");
      });

      expect(result.current.recentCaseIds).toEqual(["case-2"]);
    });

    it("persists removal to localStorage", () => {
      const existingEntries = [
        { caseId: "case-1", viewedAt: "2024-01-15T10:00:00.000Z" },
      ];
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(existingEntries));

      const { result } = renderHook(() => useRecentCases());

      act(() => {
        result.current.removeFromRecent("case-1");
      });

      const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) || "[]");
      expect(stored).toHaveLength(0);
    });

    it("handles removing non-existent case gracefully", () => {
      const { result } = renderHook(() => useRecentCases());

      act(() => {
        result.current.removeFromRecent("non-existent");
      });

      expect(result.current.recentCaseIds).toEqual([]);
    });
  });

  describe("clearRecent", () => {
    it("clears all recent entries", () => {
      const existingEntries = [
        { caseId: "case-1", viewedAt: "2024-01-15T10:00:00.000Z" },
        { caseId: "case-2", viewedAt: "2024-01-15T09:00:00.000Z" },
      ];
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(existingEntries));

      const { result } = renderHook(() => useRecentCases());

      act(() => {
        result.current.clearRecent();
      });

      expect(result.current.recentCaseIds).toEqual([]);
    });

    it("persists clear to localStorage", () => {
      const existingEntries = [
        { caseId: "case-1", viewedAt: "2024-01-15T10:00:00.000Z" },
      ];
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(existingEntries));

      const { result } = renderHook(() => useRecentCases());

      act(() => {
        result.current.clearRecent();
      });

      const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) || "[]");
      expect(stored).toHaveLength(0);
    });
  });

  describe("isRecent", () => {
    it("returns true for recent case", () => {
      const existingEntries = [
        { caseId: "case-1", viewedAt: "2024-01-15T10:00:00.000Z" },
      ];
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(existingEntries));

      const { result } = renderHook(() => useRecentCases());

      expect(result.current.isRecent("case-1")).toBe(true);
    });

    it("returns false for non-recent case", () => {
      const { result } = renderHook(() => useRecentCases());

      expect(result.current.isRecent("case-1")).toBe(false);
    });

    it("updates after adding a case", () => {
      const { result } = renderHook(() => useRecentCases());

      expect(result.current.isRecent("case-1")).toBe(false);

      act(() => {
        result.current.addToRecent("case-1");
      });

      expect(result.current.isRecent("case-1")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles rapid successive adds", () => {
      const { result } = renderHook(() => useRecentCases());

      act(() => {
        result.current.addToRecent("case-1");
        result.current.addToRecent("case-2");
        result.current.addToRecent("case-3");
      });

      expect(result.current.recentCaseIds).toEqual([
        "case-3",
        "case-2",
        "case-1",
      ]);
    });

    it("maintains order with most recent first", () => {
      const { result } = renderHook(() => useRecentCases());

      act(() => {
        result.current.addToRecent("oldest");
        result.current.addToRecent("middle");
        result.current.addToRecent("newest");
      });

      expect(result.current.recentCaseIds[0]).toBe("newest");
      expect(result.current.recentCaseIds[2]).toBe("oldest");
    });

    it("works after clear and re-add", () => {
      const { result } = renderHook(() => useRecentCases());

      act(() => {
        result.current.addToRecent("case-1");
        result.current.clearRecent();
        result.current.addToRecent("case-2");
      });

      expect(result.current.recentCaseIds).toEqual(["case-2"]);
    });
  });
});
