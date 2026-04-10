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

type UseConnectionFlowParams = Parameters<typeof useConnectionFlow>[0];

describe("useConnectionFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads cases without invoking migration tooling or exposing upgrade notice state", async () => {
    // ARRANGE
    const loadCases = vi.fn().mockResolvedValue([createMockStoredCase({ id: "case-1" })]);
    const setCases = vi.fn();
    const setError = vi.fn();
    const setHasLoadedData = vi.fn();
    const markWorkspaceReady = vi.fn();
    const initialProps: UseConnectionFlowParams = {
      isSupported: true,
      hasLoadedData: false,
      connectionState: createMockFileStorageLifecycleSelectors(),
      service: null,
      loadCases,
      setCases,
      setError,
      setHasLoadedData,
      markWorkspaceReady,
    };

    const { result } = renderHook(
      (props: UseConnectionFlowParams) => useConnectionFlow(props),
      { initialProps },
    );

    // ACT
    await act(async () => {
      await result.current.handleConnectionComplete();
    });

    // ASSERT
    expect(loadCases).toHaveBeenCalledTimes(1);
    expect(markWorkspaceReady).toHaveBeenCalledTimes(1);
    expect(loadCases.mock.invocationCallOrder[0]).toBeLessThan(
      markWorkspaceReady.mock.invocationCallOrder[0],
    );
    expect(setCases).toHaveBeenCalledWith([expect.objectContaining({ id: "case-1" })]);
    expect(setHasLoadedData).toHaveBeenCalledWith(true);
    expect(setError).toHaveBeenCalledWith(null);
    expect(result.current).not.toHaveProperty("workspaceUpgradeNoticeKind");
    expect(result.current).not.toHaveProperty("acknowledgeWorkspaceUpgradeNotice");
    expect(mockToast.info).not.toHaveBeenCalled();
  });

  it("reports connection success without any upgrade notice contract", async () => {
    // ARRANGE
    const loadCases = vi.fn().mockResolvedValue([createMockStoredCase({ id: "case-2" })]);
    const setCases = vi.fn();
    const setError = vi.fn();
    const setHasLoadedData = vi.fn();
    const markWorkspaceReady = vi.fn();

    const { result } = renderHook(() =>
      useConnectionFlow({
        isSupported: true,
        hasLoadedData: false,
        connectionState: createMockFileStorageLifecycleSelectors(),
        service: null,
        loadCases,
        setCases,
        setError,
        setHasLoadedData,
        markWorkspaceReady,
      }),
    );

    // ACT
    await act(async () => {
      await result.current.handleConnectionComplete();
    });

    // ASSERT
    expect(loadCases).toHaveBeenCalledTimes(1);
    expect(markWorkspaceReady).toHaveBeenCalledTimes(1);
    expect(result.current).not.toHaveProperty("workspaceUpgradeNoticeKind");
    expect(mockToast.info).not.toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith(
      "Connected and loaded 1 cases",
      expect.objectContaining({ id: "connection-success" }),
    );
  });

  it("reports workspace connection failures when loading cases fails", async () => {
    // ARRANGE
    const loadCases = vi.fn().mockRejectedValue(new Error("load exploded"));
    const setCases = vi.fn();
    const setError = vi.fn();
    const setHasLoadedData = vi.fn();
    const markWorkspaceReady = vi.fn();

    const { result } = renderHook(() =>
      useConnectionFlow({
        isSupported: true,
        hasLoadedData: false,
        connectionState: createMockFileStorageLifecycleSelectors(),
        service: null,
        loadCases,
        setCases,
        setError,
        setHasLoadedData,
        markWorkspaceReady,
      }),
    );

    // ACT
    await act(async () => {
      await result.current.handleConnectionComplete();
    });

    // ASSERT
    expect(loadCases).toHaveBeenCalledTimes(1);
    expect(setCases).not.toHaveBeenCalled();
    expect(setHasLoadedData).not.toHaveBeenCalled();
    expect(markWorkspaceReady).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(
      "Failed to complete workspace connection: load exploded",
    );
    expect(mockToast.error).toHaveBeenCalledWith(
      "Failed to complete workspace connection: load exploded",
      expect.objectContaining({ id: "connection-error" }),
    );
  });
});