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

import { useConnectionFlow } from "@/hooks/useConnectionFlow";
import {
  createMockFileStorageLifecycleSelectors,
  createMockStoredCase,
} from "@/src/test/testUtils";
import type { DataManager } from "@/utils/DataManager";

type UseConnectionFlowParams = Parameters<typeof useConnectionFlow>[0];

describe("useConnectionFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a one-time upgrade toast before loading cases when the workspace is migrated", async () => {
    // ARRANGE
    const migrateWorkspaceToV22 = vi
      .fn()
      .mockResolvedValueOnce({
        processedAt: "2026-04-09T00:00:00.000Z",
        files: [],
        summary: {
          migrated: 1,
          alreadyV21: 0,
          failed: 0,
          skipped: 0,
        },
      })
      .mockResolvedValueOnce({
        processedAt: "2026-04-09T00:00:01.000Z",
        files: [],
        summary: {
          migrated: 0,
          alreadyV21: 1,
          failed: 0,
          skipped: 0,
        },
      });
    const loadCases = vi.fn().mockResolvedValue([createMockStoredCase({ id: "case-1" })]);
    const setCases = vi.fn();
    const setError = vi.fn();
    const setHasLoadedData = vi.fn();
    const mockDataManager = {
      migrateWorkspaceToV22,
    } as unknown as DataManager;
    const initialProps: UseConnectionFlowParams = {
      isSupported: true,
      hasLoadedData: false,
      connectionState: createMockFileStorageLifecycleSelectors(),
      service: null,
      fileStorageService: null,
      dataManager: mockDataManager,
      loadCases,
      setCases,
      setError,
      setHasLoadedData,
    };

    const { result, rerender } = renderHook(
      (props: UseConnectionFlowParams) => useConnectionFlow(props),
      { initialProps },
    );

    // ACT
    await act(async () => {
      await result.current.handleConnectionComplete();
    });

    rerender({
      ...initialProps,
      hasLoadedData: true,
    });

    await act(async () => {
      await result.current.handleConnectionComplete();
    });

    // ASSERT
    expect(migrateWorkspaceToV22).toHaveBeenCalledTimes(2);
    expect(mockToast.info).toHaveBeenCalledWith(
      "Workspace upgraded to v2.2",
      expect.objectContaining({ id: "workspace-upgraded" }),
    );
    expect(mockToast.info).toHaveBeenCalledOnce();
    expect(migrateWorkspaceToV22.mock.invocationCallOrder[0]).toBeLessThan(
      loadCases.mock.invocationCallOrder[0],
    );
    expect(loadCases).toHaveBeenCalledTimes(2);
    expect(setCases).toHaveBeenCalledWith([expect.objectContaining({ id: "case-1" })]);
    expect(setHasLoadedData).toHaveBeenCalledWith(true);
    expect(setError).toHaveBeenCalledWith(null);
  });

  it("reports workspace connection failures when migration fails before cases load", async () => {
    // ARRANGE
    const migrateWorkspaceToV22 = vi.fn().mockRejectedValue(new Error("migration exploded"));
    const loadCases = vi.fn();
    const setCases = vi.fn();
    const setError = vi.fn();
    const setHasLoadedData = vi.fn();
    const mockDataManager = {
      migrateWorkspaceToV22,
    } as unknown as DataManager;

    const { result } = renderHook(() =>
      useConnectionFlow({
        isSupported: true,
        hasLoadedData: false,
        connectionState: createMockFileStorageLifecycleSelectors(),
        service: null,
        fileStorageService: null,
        dataManager: mockDataManager,
        loadCases,
        setCases,
        setError,
        setHasLoadedData,
      }),
    );

    // ACT
    await act(async () => {
      await result.current.handleConnectionComplete();
    });

    // ASSERT
    expect(loadCases).not.toHaveBeenCalled();
    expect(setCases).not.toHaveBeenCalled();
    expect(setHasLoadedData).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(
      "Failed to complete workspace connection: migration exploded",
    );
    expect(mockToast.error).toHaveBeenCalledWith(
      "Failed to complete workspace connection: migration exploded",
      expect.objectContaining({ id: "connection-error" }),
    );
  });
});