import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: mockToast,
  };
});

import { useCaseArchival } from "@/hooks/useCaseArchival";
import { createMockDataManager } from "@/src/test/testUtils";
import type { DataManager } from "@/utils/DataManager";
import type { RefreshQueueResult } from "@/utils/services/CaseArchiveService";

describe("useCaseArchival", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches archival-review navigation from the toast View action", async () => {
    // ARRANGE
    const refreshQueueResult: RefreshQueueResult = {
      newlyMarked: 2,
      totalPending: 4,
      newlyMarkedIds: ["case-1", "case-2"],
    };
    const mockDataManager = {
      ...createMockDataManager(),
      refreshArchivalQueue: vi.fn<() => Promise<RefreshQueueResult>>().mockResolvedValue(refreshQueueResult),
    };
    const dispatchEventSpy = vi.spyOn(globalThis, "dispatchEvent");
    const isMounted = { current: true };
    const { result } = renderHook(() =>
      useCaseArchival({
        dataManager: mockDataManager as unknown as DataManager,
        isMounted,
      }),
    );

    // ACT
    await act(async () => {
      await result.current.refreshQueue();
    });

    const [, options] = mockToast.info.mock.calls[0] ?? [];
    options?.action?.onClick();

    // ASSERT
    expect(mockDataManager.refreshArchivalQueue).toHaveBeenCalledOnce();
    expect(mockToast.info).toHaveBeenCalledWith(
      "2 cases pending archival review",
      expect.objectContaining({
        description: "Review in the Archival Review tab",
        action: expect.objectContaining({
          label: "View",
        }),
      }),
    );
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const [navigationEvent] = dispatchEventSpy.mock.calls[0] ?? [];
    expect(navigationEvent).toBeInstanceOf(CustomEvent);
    expect((navigationEvent as CustomEvent).type).toBe("app:navigate");
    expect((navigationEvent as CustomEvent).detail).toEqual({
      path: "/cases",
      caseListSegment: "archival-review",
    });
  });
});
