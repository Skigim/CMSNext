import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { usePinnedCases } from "@/hooks/usePinnedCases";
import { asTypedLocalStorageAdapterMock } from "@/src/test/localStorageAdapterMock";

vi.mock("@/utils/localStorage", async () => {
  const { localStorageAdapterModuleMock } = await import(
    "@/src/test/localStorageAdapterMock"
  );
  return localStorageAdapterModuleMock;
});

const storageMock = asTypedLocalStorageAdapterMock<string[]>("cmsnext-pinned-cases");
const pinReasonStorageMock = asTypedLocalStorageAdapterMock<Record<string, string>>(
  "cmsnext-pinned-case-reasons"
);

describe("usePinnedCases", () => {
  beforeEach(() => {
    storageMock.reset([]);
    pinReasonStorageMock.reset({});
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("returns empty array when localStorage is empty", () => {
      const { result } = renderHook(() => usePinnedCases());
      expect(result.current.pinnedCaseIds).toEqual([]);
      expect(result.current.pinnedCount).toBe(0);
      expect(result.current.getPinReason("case-1")).toBeUndefined();
    });

    it("loads existing pins from localStorage", () => {
      const existingPins = ["case-1", "case-2"];
      storageMock.mockRead.mockReturnValue(existingPins);

      const { result } = renderHook(() => usePinnedCases());
      expect(result.current.pinnedCaseIds).toEqual(["case-1", "case-2"]);
      expect(result.current.pinnedCount).toBe(2);
    });

    it("handles corrupted localStorage data gracefully", () => {
      storageMock.mockRead.mockReturnValue([]);

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

      expect(storageMock.mockWrite).toHaveBeenCalledWith(["case-1"]);
      expect(pinReasonStorageMock.mockWrite).toHaveBeenCalledWith({});
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

    it("stores a trimmed reason separately from pinned IDs", () => {
      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pin("case-1", "  Pending morning triage  ");
      });

      expect(result.current.pinnedCaseIds).toEqual(["case-1"]);
      expect(result.current.getPinReason("case-1")).toBe("Pending morning triage");
      expect(storageMock.mockWrite).toHaveBeenCalledWith(["case-1"]);
      expect(pinReasonStorageMock.mockWrite).toHaveBeenCalledWith({
        "case-1": "Pending morning triage",
      });
    });

    it("clamps overlong reasons before persisting", () => {
      const { result } = renderHook(() => usePinnedCases());
      // 240 matches the shared product limit for persisted pin reasons.
      const overlongReason = "x".repeat(300);

      act(() => {
        result.current.pin("case-1", overlongReason);
      });

      // Persisted values should honor the same 240-character clamp used by the UI.
      expect(result.current.getPinReason("case-1")).toHaveLength(240);
      expect(pinReasonStorageMock.mockWrite).toHaveBeenCalledWith({
        "case-1": "x".repeat(240),
      });
    });

    it("does not store an empty reason", () => {
      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pin("case-1", "   ");
      });

      expect(result.current.getPinReason("case-1")).toBeUndefined();
      expect(pinReasonStorageMock.mockWrite).toHaveBeenCalledWith({});
    });
  });

  describe("unpin", () => {
    it("removes a case from pinned list", () => {
      storageMock.mockRead.mockReturnValue(["case-1", "case-2"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.unpin("case-1");
      });

      expect(result.current.pinnedCaseIds).toEqual(["case-2"]);
    });

    it("persists removal to localStorage", () => {
      storageMock.mockRead.mockReturnValue(["case-1"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.unpin("case-1");
      });

      expect(storageMock.mockWrite).toHaveBeenCalledWith([]);
      expect(pinReasonStorageMock.mockWrite).toHaveBeenCalledWith({});
    });

    it("handles unpinning non-existent case gracefully", () => {
      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.unpin("non-existent");
      });

      expect(result.current.pinnedCaseIds).toEqual([]);
    });

    it("removes the associated reason when a case is unpinned", () => {
      storageMock.mockRead.mockReturnValue(["case-1"]);
      pinReasonStorageMock.mockRead.mockReturnValue({
        "case-1": "Pending morning triage",
      });

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.unpin("case-1");
      });

      expect(result.current.pinnedCaseIds).toEqual([]);
      expect(result.current.getPinReason("case-1")).toBeUndefined();
      expect(pinReasonStorageMock.mockWrite).toHaveBeenCalledWith({});
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
      storageMock.mockRead.mockReturnValue(["case-1"]);

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

      expect(storageMock.mockWrite).toHaveBeenCalledWith(["case-1"]);
      expect(pinReasonStorageMock.mockWrite).toHaveBeenCalledWith({});

      act(() => {
        result.current.togglePin("case-1");
      });

      expect(storageMock.mockWrite).toHaveBeenCalledWith([]);
      expect(pinReasonStorageMock.mockWrite).toHaveBeenCalledWith({});
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

    it("stores the reason when toggling a case on", () => {
      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.togglePin("case-1", "Ready for tomorrow");
      });

      expect(result.current.getPinReason("case-1")).toBe("Ready for tomorrow");
      expect(pinReasonStorageMock.mockWrite).toHaveBeenCalledWith({
        "case-1": "Ready for tomorrow",
      });
    });

    it("removes the reason when toggling a case off", () => {
      storageMock.mockRead.mockReturnValue(["case-1"]);
      pinReasonStorageMock.mockRead.mockReturnValue({
        "case-1": "Ready for tomorrow",
      });

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.togglePin("case-1");
      });

      expect(result.current.getPinReason("case-1")).toBeUndefined();
      expect(pinReasonStorageMock.mockWrite).toHaveBeenCalledWith({});
    });
  });

  describe("isPinned", () => {
    it("returns true for pinned case", () => {
      storageMock.mockRead.mockReturnValue(["case-1"]);

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

  describe("getPinReason", () => {
    it("returns the stored reason for a pinned case", () => {
      storageMock.mockRead.mockReturnValue(["case-1"]);
      pinReasonStorageMock.mockRead.mockReturnValue({
        "case-1": "Needs supervisor review",
      });

      const { result } = renderHook(() => usePinnedCases());

      expect(result.current.getPinReason("case-1")).toBe("Needs supervisor review");
    });

    it("returns undefined when no reason exists", () => {
      const { result } = renderHook(() => usePinnedCases());

      expect(result.current.getPinReason("case-1")).toBeUndefined();
    });
  });

  describe("canPinMore", () => {
    it("returns true when under limit", () => {
      const { result } = renderHook(() => usePinnedCases(5));

      expect(result.current.canPinMore).toBe(true);
    });

    it("returns false when at limit", () => {
      storageMock.mockRead.mockReturnValue(["case-1", "case-2"]);

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
      storageMock.mockRead.mockReturnValue(["a", "b", "c"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.reorder("c", 0);
      });

      expect(result.current.pinnedCaseIds).toEqual(["c", "a", "b"]);
    });

    it("persists reorder to localStorage", () => {
      storageMock.mockRead.mockReturnValue(["a", "b", "c"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.reorder("c", 0);
      });

      expect(storageMock.mockWrite).toHaveBeenCalledWith(["c", "a", "b"]);
    });

    it("handles reorder of non-existent case", () => {
      storageMock.mockRead.mockReturnValue(["a", "b"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.reorder("non-existent", 0);
      });

      expect(result.current.pinnedCaseIds).toEqual(["a", "b"]);
    });

    it("clamps index to valid range", () => {
      storageMock.mockRead.mockReturnValue(["a", "b", "c"]);

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
      storageMock.mockRead.mockReturnValue(["case-1", "case-2", "case-3"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pruneStale(["case-1", "case-3"]);
      });

      expect(result.current.pinnedCaseIds).toEqual(["case-1", "case-3"]);
      expect(result.current.pinnedCount).toBe(2);
      expect(storageMock.mockWrite).toHaveBeenCalledWith(["case-1", "case-3"]);
      expect(pinReasonStorageMock.mockWrite).toHaveBeenCalledWith({});
    });

    it("does not write to storage when nothing is stale", () => {
      storageMock.mockRead.mockReturnValue(["case-1", "case-2"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pruneStale(["case-1", "case-2", "case-3"]);
      });

      expect(result.current.pinnedCaseIds).toEqual(["case-1", "case-2"]);
      expect(storageMock.mockWrite).not.toHaveBeenCalled();
    });

    it("removes all pins when valid set is empty", () => {
      storageMock.mockRead.mockReturnValue(["case-1", "case-2"]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pruneStale([]);
      });

      expect(result.current.pinnedCaseIds).toEqual([]);
      expect(result.current.pinnedCount).toBe(0);
      expect(storageMock.mockWrite).toHaveBeenCalledWith([]);
      expect(pinReasonStorageMock.mockWrite).toHaveBeenCalledWith({});
    });

    it("is a no-op when pinned list is already empty", () => {
      storageMock.mockRead.mockReturnValue([]);

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pruneStale(["case-1"]);
      });

      expect(result.current.pinnedCaseIds).toEqual([]);
      expect(storageMock.mockWrite).not.toHaveBeenCalled();
    });

    it("removes stale pin reasons alongside stale pinned IDs", () => {
      storageMock.mockRead.mockReturnValue(["case-1", "case-2"]);
      pinReasonStorageMock.mockRead.mockReturnValue({
        "case-1": "Keep",
        "case-2": "Remove",
      });

      const { result } = renderHook(() => usePinnedCases());

      act(() => {
        result.current.pruneStale(["case-1"]);
      });

      expect(result.current.pinnedCaseIds).toEqual(["case-1"]);
      expect(result.current.getPinReason("case-1")).toBe("Keep");
      expect(result.current.getPinReason("case-2")).toBeUndefined();
      expect(pinReasonStorageMock.mockWrite).toHaveBeenCalledWith({
        "case-1": "Keep",
      });
    });
  });
});
