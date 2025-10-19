import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockCaseDisplay, toast as mockToast } from "@/src/test/testUtils";
import { createAlertsIndexFromAlerts } from "@/utils/alertsData";
import type { AlertWithMatch } from "@/utils/alertsData";
import type { DataManager } from "@/utils/DataManager";
import { useAlertsFlow } from "@/hooks/useAlertsFlow";

const now = new Date().toISOString();

const buildAlert = (overrides: Partial<AlertWithMatch> = {}): AlertWithMatch => ({
  id: "alert-1",
  alertCode: "A100",
  alertType: "eligibility",
  alertDate: now,
  createdAt: now,
  updatedAt: now,
  status: "new",
  resolvedAt: null,
  resolutionNotes: undefined,
  description: "Sample alert",
  program: "Medical",
  mcNumber: "MCN123",
  matchStatus: "matched",
  matchedCaseId: "case-1",
  matchedCaseName: "Test Case",
  matchedCaseStatus: "Pending",
  ...overrides,
});

const createDataManager = (impl: Partial<DataManager>): DataManager => impl as unknown as DataManager;

describe("useAlertsFlow", () => {
  beforeEach(() => {
      mockToast.error.mockClear();
      mockToast.success.mockClear();
      mockToast.warning.mockClear();
      mockToast.info.mockClear();
      mockToast.loading.mockClear();
      mockToast.dismiss.mockClear();
    });

  it("loads alerts index when data manager is available", async () => {
  const caseDisplay = createMockCaseDisplay({ id: "case-1" });
  const cases = [caseDisplay];
  const initialAlert = buildAlert({ matchedCaseId: caseDisplay.id, matchedCaseName: caseDisplay.name });
  const initialIndex = createAlertsIndexFromAlerts([initialAlert]);

    const dataManager = createDataManager({
      getAlertsIndex: vi.fn().mockResolvedValue(initialIndex),
      updateAlertStatus: vi.fn(),
    });

    const { result } = renderHook(() =>
      useAlertsFlow({
        cases,
        selectedCase: caseDisplay,
        hasLoadedData: true,
        dataManager,
      }),
    );

    await waitFor(() => expect(result.current.alertsIndex.alerts).toHaveLength(1));
    expect(result.current.openAlerts).toHaveLength(1);
    expect(mockToast.warning).not.toHaveBeenCalled();
  });

  it("resolves alerts via data manager and reloads state", async () => {
  const caseDisplay = createMockCaseDisplay({ id: "case-1" });
  const cases = [caseDisplay];
    const initialAlert = buildAlert({ matchedCaseId: caseDisplay.id, matchedCaseName: caseDisplay.name });
    const resolvedAlert = buildAlert({
      id: initialAlert.id,
      matchedCaseId: caseDisplay.id,
      matchedCaseName: caseDisplay.name,
      status: "resolved",
      resolvedAt: now,
    });

    const getAlertsIndexMock = vi
      .fn()
      .mockResolvedValueOnce(createAlertsIndexFromAlerts([initialAlert]))
      .mockResolvedValue(createAlertsIndexFromAlerts([resolvedAlert]));

    const updateAlertStatusMock = vi.fn().mockResolvedValue(undefined);

    const dataManager = createDataManager({
      getAlertsIndex: getAlertsIndexMock,
      updateAlertStatus: updateAlertStatusMock,
    });

    const { result } = renderHook(() =>
      useAlertsFlow({
        cases,
        selectedCase: caseDisplay,
        hasLoadedData: true,
        dataManager,
      }),
    );

    await waitFor(() => expect(result.current.alertsIndex.alerts).toHaveLength(1));

    const activeAlert = result.current.alertsIndex.alerts[0];

    await act(async () => {
      await result.current.onResolveAlert(activeAlert);
    });

    expect(updateAlertStatusMock).toHaveBeenCalledTimes(1);
    expect(updateAlertStatusMock.mock.calls[0]).toMatchObject([
      expect.any(String),
      expect.objectContaining({ status: "resolved" }),
      { cases },
    ]);

    await waitFor(() => {
      expect(result.current.alertsIndex.alerts[0].status).toBe("resolved");
    });
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith(
        "Alert resolved",
        expect.objectContaining({ description: expect.any(String) }),
      ),
    );
  });

  it("shows an error toast when alerts cannot be updated", async () => {
    const caseDisplay = createMockCaseDisplay({ id: "case-1" });
    const cases = [caseDisplay];
    const alert = buildAlert({ matchedCaseId: caseDisplay.id, matchedCaseName: caseDisplay.name });

    const dataManager = createDataManager({
      getAlertsIndex: vi.fn().mockResolvedValue(createAlertsIndexFromAlerts([alert])),
      updateAlertStatus: vi.fn().mockRejectedValue(new Error("network")),
    });

    const { result } = renderHook(() =>
      useAlertsFlow({
        cases,
        selectedCase: caseDisplay,
        hasLoadedData: true,
        dataManager,
      }),
    );

    await waitFor(() => expect(result.current.alertsIndex.alerts).toHaveLength(1));

    await act(async () => {
      await result.current.onResolveAlert(result.current.alertsIndex.alerts[0]);
    });

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Unable to resolve alert. Please try again."),
    );
  });

  it("prevents resolving alerts when data manager is unavailable", async () => {
    const caseDisplay = createMockCaseDisplay({ id: "active-case" });
    const cases = [caseDisplay];
    const alert = buildAlert({ matchedCaseId: caseDisplay.id, matchedCaseName: caseDisplay.name });

    const { result } = renderHook(() =>
      useAlertsFlow({
        cases,
        selectedCase: caseDisplay,
        hasLoadedData: true,
        dataManager: null,
      }),
    );

    await act(async () => {
      await result.current.onResolveAlert(alert);
    });

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        "Alerts service is not ready. Try again after reconnecting.",
      ),
    );
  });
});
