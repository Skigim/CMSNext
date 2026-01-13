import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { useRecentCases } from "@/hooks/useRecentCases";

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

describe("useRecentCases", () => {
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
      const { result } = renderHook(() => useRecentCases());
      expect(result.current.recentCaseIds).toEqual([]);
    });

    it("loads existing entries from localStorage", () => {
      const existingEntries = [
        { caseId: "case-1", viewedAt: "2024-01-15T10:00:00.000Z" },
        { caseId: "case-2", viewedAt: "2024-01-15T09:00:00.000Z" },
      ];
      mockRead.mockReturnValue(existingEntries);

      const { result } = renderHook(() => useRecentCases());
      expect(result.current.recentCaseIds).toEqual(["case-1", "case-2"]);
    });

    it("handles corrupted localStorage data gracefully", () => {
      mockRead.mockReturnValue([]);

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

      expect(mockWrite).toHaveBeenCalled();
      const savedData = mockWrite.mock.calls[0][0];
      expect(savedData).toHaveLength(1);
      expect(savedData[0].caseId).toBe("case-1");
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
      mockRead.mockReturnValue(existingEntries);

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
      mockRead.mockReturnValue(existingEntries);

      const { result } = renderHook(() => useRecentCases());

      act(() => {
        result.current.removeFromRecent("case-1");
      });

      expect(mockWrite).toHaveBeenCalledWith([]);
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
      mockRead.mockReturnValue(existingEntries);

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
      mockRead.mockReturnValue(existingEntries);

      const { result } = renderHook(() => useRecentCases());

      act(() => {
        result.current.clearRecent();
      });

      expect(mockClear).toHaveBeenCalled();
    });
  });

  describe("isRecent", () => {
    it("returns true for recent case", () => {
      const existingEntries = [
        { caseId: "case-1", viewedAt: "2024-01-15T10:00:00.000Z" },
      ];
      mockRead.mockReturnValue(existingEntries);

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
