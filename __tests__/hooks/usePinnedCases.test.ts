import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { usePinnedCases } from "@/hooks/usePinnedCases";

// Use vi.hoisted() to properly hoist mock functions before vi.mock
const { mockRead, mockWrite, mockClear } = vi.hoisted(() => ({
  mockRead: vi.fn(),
  mockWrite: vi.fn(),
  mockClear: vi.fn(),
}));

// Mock the localStorage adapter module
vi.mock("@/utils/localStorage", () => ({
  createLocalStorageAdapter: vi.fn(() => ({
    read: mockRead,
    write: mockWrite,
    clear: mockClear,
  })),
  hasLocalStorage: vi.fn(() => true),
}));

describe("usePinnedCases", () => {
  beforeEach(() => {
    // Reset mock implementations for each test
    mockRead.mockReset();
    mockWrite.mockReset();
    mockClear.mockReset();
    mockRead.mockReturnValue([]);
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("returns empty array when localStorage is empty", () => {
      const { result } = renderHook(() => usePinnedCases());
      expect(result.current.pinnedCaseIds).toEqual([]);
      expect(result.current.pinnedCount).toBe(0);
    });

    it("loads existing pins from localStorage", () => {
      const existingPins = ["case-1", "case-2"];
      mockRead.mockReturnValue(existingPins);

      const { result } = renderHook(() => usePinnedCases());
      expect(result.current.pinnedCaseIds).toEqual(["case-1", "case-2"]);
      expect(result.current.pinnedCount).toBe(2);
    });

    it("handles corrupted localStorage data gracefully", () => {
      mockRead.mockReturnValue([]);

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

      expect(mockWrite).toHaveBeenCalledWith(["case-1"]);
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
      mockRead.mockReturnValue(["case-1", "case-2"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.unpin("case-1");
      });

      expect(result.current.pinnedCaseIds).toEqual(["case-2"]);
    });

    it("persists removal to localStorage", () => {
      mockRead.mockReturnValue(["case-1"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.unpin("case-1");
      });

      expect(mockWrite).toHaveBeenCalledWith([]);
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
      mockRead.mockReturnValue(["case-1"]);

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

      expect(mockWrite).toHaveBeenCalledWith(["case-1"]);

      act(() => {
        result.current.togglePin("case-1");
      });

      expect(mockWrite).toHaveBeenCalledWith([]);
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
      mockRead.mockReturnValue(["case-1"]);

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
      mockRead.mockReturnValue(["case-1", "case-2"]);

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
      mockRead.mockReturnValue(["a", "b", "c"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.reorder("c", 0);
      });

      expect(result.current.pinnedCaseIds).toEqual(["c", "a", "b"]);
    });

    it("persists reorder to localStorage", () => {
      mockRead.mockReturnValue(["a", "b", "c"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.reorder("c", 0);
      });

      expect(mockWrite).toHaveBeenCalledWith(["c", "a", "b"]);
    });

    it("handles reorder of non-existent case", () => {
      mockRead.mockReturnValue(["a", "b"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.reorder("non-existent", 0);
      });

      expect(result.current.pinnedCaseIds).toEqual(["a", "b"]);
    });

    it("clamps index to valid range", () => {
      mockRead.mockReturnValue(["a", "b", "c"]);

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

  describe("pruneStale", () => {
    it("removes pinned IDs not present in the valid set", () => {
      mockRead.mockReturnValue(["case-1", "case-2", "case-3"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pruneStale(["case-1", "case-3"]);
      });

      expect(result.current.pinnedCaseIds).toEqual(["case-1", "case-3"]);
      expect(result.current.pinnedCount).toBe(2);
      expect(mockWrite).toHaveBeenCalledWith(["case-1", "case-3"]);
    });

    it("does not write to storage when nothing is stale", () => {
      mockRead.mockReturnValue(["case-1", "case-2"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pruneStale(["case-1", "case-2", "case-3"]);
      });

      expect(result.current.pinnedCaseIds).toEqual(["case-1", "case-2"]);
      expect(mockWrite).not.toHaveBeenCalled();
    });

    it("removes all pins when valid set is empty", () => {
      mockRead.mockReturnValue(["case-1", "case-2"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pruneStale([]);
      });

      expect(result.current.pinnedCaseIds).toEqual([]);
      expect(result.current.pinnedCount).toBe(0);
      expect(mockWrite).toHaveBeenCalledWith([]);
    });

    it("is a no-op when pinned list is already empty", () => {
      mockRead.mockReturnValue([]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pruneStale(["case-1"]);
      });

      expect(result.current.pinnedCaseIds).toEqual([]);
      expect(mockWrite).not.toHaveBeenCalled();
    });
  });
});
