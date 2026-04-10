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

  it("opens a required upgrade notice after loading a migrated workspace", async () => {
    // ARRANGE
    const migrateWorkspaceToV22 = vi.fn().mockResolvedValue({
      processedAt: "2026-04-09T00:00:00.000Z",
      files: [
        {
          fileName: "case-tracker-data.json",
          fileKind: "workspace",
          disposition: "migrated",
          sourceVersion: "2.1",
          counts: {
            people: 1,
            cases: 1,
            financials: 0,
            notes: 0,
            alerts: 0,
          },
          validationErrors: [],
          message: "Migrated workspace to v2.2.",
        },
      ],
      summary: {
        migrated: 1,
        alreadyV21: 0,
        failed: 0,
        skipped: 0,
      },
    });
    const loadCases = vi.fn().mockResolvedValue([createMockStoredCase({ id: "case-1" })]);
    const setCases = vi.fn();
    const setError = vi.fn();
    const setHasLoadedData = vi.fn();
    const markWorkspaceReady = vi.fn();
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
    expect(migrateWorkspaceToV22).toHaveBeenCalledTimes(1);
    expect(migrateWorkspaceToV22.mock.invocationCallOrder[0]).toBeLessThan(
      loadCases.mock.invocationCallOrder[0],
    );
    expect(loadCases).toHaveBeenCalledTimes(1);
    expect(markWorkspaceReady).toHaveBeenCalledTimes(1);
    expect(loadCases.mock.invocationCallOrder[0]).toBeLessThan(
      markWorkspaceReady.mock.invocationCallOrder[0],
    );
    expect(setCases).toHaveBeenCalledWith([expect.objectContaining({ id: "case-1" })]);
    expect(setHasLoadedData).toHaveBeenCalledWith(true);
    expect(setError).toHaveBeenCalledWith(null);
    expect(result.current.workspaceUpgradeNoticeKind).toBe("migrated");
    expect(mockToast.info).not.toHaveBeenCalled();

    await act(async () => {
      result.current.acknowledgeWorkspaceUpgradeNotice();
    });

    expect(result.current.workspaceUpgradeNoticeKind).toBeNull();
  });

  it("opens a required upgrade notice after loading an already-current workspace", async () => {
    // ARRANGE
    const migrateWorkspaceToV22 = vi.fn().mockResolvedValue({
      processedAt: "2026-04-09T00:00:00.000Z",
      files: [
        {
          fileName: "case-tracker-data.json",
          fileKind: "workspace",
          disposition: "already-current",
          sourceVersion: "2.2",
          counts: {
            people: 1,
            cases: 1,
            financials: 0,
            notes: 0,
            alerts: 0,
          },
          validationErrors: [],
          message: "Workspace already uses the canonical v2.2 format.",
        },
      ],
      summary: {
        migrated: 0,
        alreadyV21: 1,
        failed: 0,
        skipped: 0,
      },
    });
    const loadCases = vi.fn().mockResolvedValue([createMockStoredCase({ id: "case-2" })]);
    const setCases = vi.fn();
    const setError = vi.fn();
    const setHasLoadedData = vi.fn();
    const markWorkspaceReady = vi.fn();
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
        markWorkspaceReady,
      }),
    );

    // ACT
    await act(async () => {
      await result.current.handleConnectionComplete();
    });

    // ASSERT
    expect(result.current.workspaceUpgradeNoticeKind).toBe("current");
    expect(loadCases).toHaveBeenCalledTimes(1);
    expect(markWorkspaceReady).toHaveBeenCalledTimes(1);
    expect(mockToast.info).not.toHaveBeenCalled();
  });

  it("reports workspace connection failures when migration fails before cases load", async () => {
    // ARRANGE
    const migrateWorkspaceToV22 = vi.fn().mockRejectedValue(new Error("migration exploded"));
    const loadCases = vi.fn();
    const setCases = vi.fn();
    const setError = vi.fn();
    const setHasLoadedData = vi.fn();
    const markWorkspaceReady = vi.fn();
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
        markWorkspaceReady,
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
    expect(markWorkspaceReady).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(
      "Failed to complete workspace connection: migration exploded",
    );
    expect(mockToast.error).toHaveBeenCalledWith(
      "Failed to complete workspace connection: migration exploded",
      expect.objectContaining({ id: "connection-error" }),
    );
  });
});