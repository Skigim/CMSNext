import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { usePinnedCases } from "@/hooks/usePinnedCases";

const STORAGE_KEY = "cmsnext-pinned-cases";

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

describe("usePinnedCases", () => {
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
      const { result } = renderHook(() => usePinnedCases());
      expect(result.current.pinnedCaseIds).toEqual([]);
      expect(result.current.pinnedCount).toBe(0);
    });

    it("loads existing pins from localStorage", () => {
      const existingPins = ["case-1", "case-2"];
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(existingPins));

      const { result } = renderHook(() => usePinnedCases());
      expect(result.current.pinnedCaseIds).toEqual(["case-1", "case-2"]);
      expect(result.current.pinnedCount).toBe(2);
    });

    it("handles corrupted localStorage data gracefully", () => {
      localStorageMock.setItem(STORAGE_KEY, "invalid-json{");

      const { result } = renderHook(() => usePinnedCases());
      expect(result.current.pinnedCaseIds).toEqual([]);
    });
  });

  describe("pin", () => {
    it("adds a case to pinned list", () => {
      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pin("case-1");
      });

      expect(result.current.pinnedCaseIds).toContain("case-1");
      expect(result.current.pinnedCount).toBe(1);
    });

    it("does not add duplicate pins", () => {
      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pin("case-1");
        result.current.pin("case-1");
      });

      expect(result.current.pinnedCaseIds).toEqual(["case-1"]);
    });

    it("persists to localStorage", () => {
      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pin("case-1");
      });

      const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) || "[]");
      expect(stored).toEqual(["case-1"]);
    });

    it("respects maxPins limit", () => {
      const { result } = renderHook(() => usePinnedCases(3));

      act(() => {
        result.current.pin("case-1");
        result.current.pin("case-2");
        result.current.pin("case-3");
        result.current.pin("case-4"); // Should not be added
      });

      expect(result.current.pinnedCaseIds).toHaveLength(3);
      expect(result.current.pinnedCaseIds).not.toContain("case-4");
    });
  });

  describe("unpin", () => {
    it("removes a case from pinned list", () => {
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(["case-1", "case-2"]));

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.unpin("case-1");
      });

      expect(result.current.pinnedCaseIds).toEqual(["case-2"]);
    });

    it("persists removal to localStorage", () => {
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(["case-1"]));

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.unpin("case-1");
      });

      const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) || "[]");
      expect(stored).toEqual([]);
    });

    it("handles unpinning non-existent case gracefully", () => {
      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.unpin("non-existent");
      });

      expect(result.current.pinnedCaseIds).toEqual([]);
    });
  });

  describe("togglePin", () => {
    it("pins an unpinned case", () => {
      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.togglePin("case-1");
      });

      expect(result.current.pinnedCaseIds).toContain("case-1");
    });

    it("unpins a pinned case", () => {
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(["case-1"]));

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.togglePin("case-1");
      });

      expect(result.current.pinnedCaseIds).not.toContain("case-1");
    });

    it("persists toggle to localStorage", () => {
      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.togglePin("case-1");
      });

      let stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) || "[]");
      expect(stored).toContain("case-1");

      act(() => {
        result.current.togglePin("case-1");
      });

      stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) || "[]");
      expect(stored).not.toContain("case-1");
    });

    it("respects maxPins when toggling on", () => {
      const { result } = renderHook(() => usePinnedCases(2));

      act(() => {
        result.current.pin("case-1");
        result.current.pin("case-2");
        result.current.togglePin("case-3"); // Should not be added
      });

      expect(result.current.pinnedCaseIds).toEqual(["case-1", "case-2"]);
    });
  });

  describe("isPinned", () => {
    it("returns true for pinned case", () => {
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(["case-1"]));

      const { result } = renderHook(() => usePinnedCases());

      expect(result.current.isPinned("case-1")).toBe(true);
    });

    it("returns false for unpinned case", () => {
      const { result } = renderHook(() => usePinnedCases());

      expect(result.current.isPinned("case-1")).toBe(false);
    });

    it("updates after pin operation", () => {
      const { result } = renderHook(() => usePinnedCases());

      expect(result.current.isPinned("case-1")).toBe(false);

      act(() => {
        result.current.pin("case-1");
      });

      expect(result.current.isPinned("case-1")).toBe(true);
    });
  });

  describe("canPinMore", () => {
    it("returns true when under limit", () => {
      const { result } = renderHook(() => usePinnedCases(5));

      expect(result.current.canPinMore).toBe(true);
    });

    it("returns false when at limit", () => {
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(["case-1", "case-2"]));

      const { result } = renderHook(() => usePinnedCases(2));

      expect(result.current.canPinMore).toBe(false);
    });

    it("updates after pin operation", () => {
      const { result } = renderHook(() => usePinnedCases(1));

      expect(result.current.canPinMore).toBe(true);

      act(() => {
        result.current.pin("case-1");
      });

      expect(result.current.canPinMore).toBe(false);
    });
  });

  describe("reorder", () => {
    it("moves a case to a new position", () => {
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(["a", "b", "c"]));

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.reorder("c", 0);
      });

      expect(result.current.pinnedCaseIds).toEqual(["c", "a", "b"]);
    });

    it("persists reorder to localStorage", () => {
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(["a", "b", "c"]));

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.reorder("c", 0);
      });

      const stored = JSON.parse(localStorageMock.getItem(STORAGE_KEY) || "[]");
      expect(stored).toEqual(["c", "a", "b"]);
    });

    it("handles reorder of non-existent case", () => {
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(["a", "b"]));

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.reorder("non-existent", 0);
      });

      expect(result.current.pinnedCaseIds).toEqual(["a", "b"]);
    });

    it("clamps index to valid range", () => {
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(["a", "b", "c"]));

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.reorder("a", 100);
      });

      expect(result.current.pinnedCaseIds).toEqual(["b", "c", "a"]);
    });
  });

  describe("edge cases", () => {
    it("uses default maxPins of 20", () => {
      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        for (let i = 1; i <= 21; i++) {
          result.current.pin(`case-${i}`);
        }
      });

      expect(result.current.pinnedCaseIds).toHaveLength(20);
      expect(result.current.canPinMore).toBe(false);
    });

    it("handles rapid successive operations", () => {
      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pin("case-1");
        result.current.pin("case-2");
        result.current.unpin("case-1");
        result.current.pin("case-3");
      });

      expect(result.current.pinnedCaseIds).toEqual(["case-2", "case-3"]);
    });

    it("maintains correct count after operations", () => {
      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pin("case-1");
        result.current.pin("case-2");
      });
      expect(result.current.pinnedCount).toBe(2);

      act(() => {
        result.current.unpin("case-1");
      });
      expect(result.current.pinnedCount).toBe(1);
    });
  });
});
