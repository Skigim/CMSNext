import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  createMockFileStorageLifecycleSelectors,
  createMockNewCaseRecordData,
  createMockNewPersonData,
  createMockStoredCase,
  toast as mockToast,
} from "@/src/test/testUtils";

vi.mock("@/utils/performanceTracker", () => ({
  startMeasurement: vi.fn(),
  endMeasurement: vi.fn(),
}));

import { useNavigationFlow } from "@/hooks/useNavigationFlow";
import { startMeasurement, endMeasurement } from "@/utils/performanceTracker";
const startMeasurementMock = vi.mocked(startMeasurement);
const endMeasurementMock = vi.mocked(endMeasurement);

function createSaveCaseMock(resolvedValue?: ReturnType<typeof createMockStoredCase>) {
  return vi.fn().mockResolvedValue(resolvedValue);
}

function createDeleteCaseMock() {
  return vi.fn().mockResolvedValue(undefined);
}

function renderNavigationFlow({
  cases = [],
  connectionState = createMockFileStorageLifecycleSelectors(),
  saveCase = createSaveCaseMock(),
  deleteCase = createDeleteCaseMock(),
}: {
  cases?: ReturnType<typeof createMockStoredCase>[];
  connectionState?: ReturnType<typeof createMockFileStorageLifecycleSelectors>;
  saveCase?: ReturnType<typeof createSaveCaseMock>;
  deleteCase?: ReturnType<typeof createDeleteCaseMock>;
} = {}) {
  const renderResult = renderHook(() =>
    useNavigationFlow({
      cases,
      connectionState,
      saveCase,
      deleteCase,
    }),
  );

  return {
    ...renderResult,
    saveCase,
    deleteCase,
  };
}

function getLastMeasurementMetadata(measurementName: string) {
  const matchingCalls = endMeasurementMock.mock.calls.filter(([name]) => name === measurementName);
  const lastCall = matchingCalls[matchingCalls.length - 1];
  return lastCall?.[1];
}

describe("useNavigationFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to case details and records measurements", () => {
    const existingCase = createMockStoredCase({ id: "case-1" });
    const { result } = renderNavigationFlow({
      cases: [existingCase],
    });

    expect(result.current.currentView).toBe("dashboard");

    act(() => {
      result.current.viewCase(existingCase.id);
    });

    expect(result.current.currentView).toBe("details");
    expect(result.current.selectedCaseId).toBe(existingCase.id);
    expect(startMeasurementMock).toHaveBeenCalledWith(
      "navigation:viewCase",
      expect.objectContaining({ caseId: existingCase.id, locked: false }),
    );
    expect(endMeasurementMock).toHaveBeenCalledWith(
      "navigation:viewCase",
      expect.objectContaining({ caseId: existingCase.id, blocked: false, result: "details" }),
    );
  });

  it("routes incomplete cases into intake instead of details", () => {
    const incompleteCase = createMockStoredCase({
      id: "case-incomplete",
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        intakeCompleted: false,
      },
    });
    const { result } = renderNavigationFlow({
      cases: [incompleteCase],
    });

    act(() => {
      result.current.viewCase(incompleteCase.id);
    });

    expect(result.current.currentView).toBe("intake");
    expect(result.current.selectedCaseId).toBe(incompleteCase.id);
    expect(endMeasurementMock).toHaveBeenCalledWith(
      "navigation:viewCase",
      expect.objectContaining({ caseId: incompleteCase.id, blocked: false, result: "intake" }),
    );
  });

  it("blocks restricted navigation when storage is locked", async () => {
    const existingCase = createMockStoredCase({ id: "case-locked" });
    const { result } = renderNavigationFlow({
      cases: [existingCase],
      connectionState: createMockFileStorageLifecycleSelectors({
        isBlocked: true,
        isReady: false,
        permissionStatus: "denied",
      }),
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });

    expect(result.current.navigationLock.locked).toBe(true);
    expect(result.current.currentView).toBe("dashboard");

    mockToast.error.mockClear();

    act(() => {
      result.current.newCase();
    });

    expect(result.current.currentView).toBe("dashboard");
    expect(startMeasurementMock).toHaveBeenCalledWith(
      "navigation:newCase",
      expect.objectContaining({ locked: true }),
    );

    const lastMeasurement = getLastMeasurementMetadata("navigation:newCase");
    expect(lastMeasurement).toMatchObject({ blocked: true });
    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining("Permission to the data folder was denied"),
      expect.any(Object),
    );
  });

  it("navigates to intake view when newCase is called", async () => {
    const existingCase = createMockStoredCase({ id: "case-edit" });
    const { result } = renderNavigationFlow({
      cases: [existingCase],
      saveCase: createSaveCaseMock(existingCase),
    });

    // Initially on dashboard
    expect(result.current.currentView).toBe("dashboard");
    expect(result.current.showNewCaseModal).toBe(false);

    // Trigger new case
    act(() => {
      result.current.newCase();
    });

    // Should navigate to intake view (not open modal)
    expect(result.current.currentView).toBe("intake");
    expect(result.current.showNewCaseModal).toBe(false);
    expect(startMeasurementMock).toHaveBeenCalledWith(
      "navigation:newCase",
      expect.objectContaining({ locked: false }),
    );
    expect(endMeasurementMock).toHaveBeenCalledWith(
      "navigation:newCase",
      expect.objectContaining({ result: "intake", source: "dashboard" }),
    );
  });

  it("tracks and consumes an archival-review list segment request without changing normal list navigation", () => {
    // ARRANGE
    const { result } = renderNavigationFlow();

    // ACT
    act(() => {
      result.current.navigateToListSegment("archival-review");
    });

    // ASSERT
    expect(result.current.currentView).toBe("list");
    expect(result.current.requestedCaseListSegment).toBe("archival-review");
    expect(result.current.requestedCaseListSegmentKey).toBe(1);

    // ACT
    act(() => {
      result.current.consumeRequestedCaseListSegment(1);
    });

    // ASSERT
    expect(result.current.requestedCaseListSegment).toBeNull();
    expect(result.current.requestedCaseListSegmentKey).toBe(1);

    // ACT
    act(() => {
      result.current.navigate("list");
    });

    // ASSERT
    expect(result.current.currentView).toBe("list");
    expect(result.current.requestedCaseListSegment).toBeNull();
    expect(result.current.requestedCaseListSegmentKey).toBe(1);
  });

  it("opens Quick Add without leaving the current view", () => {
    // ARRANGE
    const { result } = renderNavigationFlow();

    expect(result.current.currentView).toBe("dashboard");
    expect(result.current.showNewCaseModal).toBe(false);

    // ACT
    act(() => {
      result.current.quickAdd();
    });

    // ASSERT
    expect(result.current.currentView).toBe("dashboard");
    expect(result.current.showNewCaseModal).toBe(true);
    expect(endMeasurementMock).toHaveBeenCalledWith(
      "navigation:quickAdd",
      expect.objectContaining({ result: "modal", source: "dashboard" }),
    );
  });

  it("returns to the list after saving a quick add opened from list", () => {
    // ARRANGE
    const createdCase = createMockStoredCase({ id: "case-created" });
    const { result } = renderNavigationFlow({
      cases: [createdCase],
    });

    act(() => {
      result.current.navigate("list");
    });

    // ACT
    act(() => {
      result.current.quickAdd();
    });

    act(() => {
      result.current.completeNewCase(createdCase.id, createdCase);
    });

    act(() => {
      result.current.backToList();
    });

    // ASSERT
    expect(result.current.currentView).toBe("list");
    expect(result.current.selectedCaseId).toBeNull();
  });

  it("returns to the originating details view when intake is canceled", () => {
    const existingCase = createMockStoredCase({ id: "case-origin" });
    const { result } = renderNavigationFlow({
      cases: [existingCase],
    });

    act(() => {
      result.current.viewCase(existingCase.id);
    });

    expect(result.current.currentView).toBe("details");
    expect(result.current.selectedCaseId).toBe(existingCase.id);

    act(() => {
      result.current.newCase();
    });

    expect(result.current.currentView).toBe("intake");
    expect(result.current.selectedCaseId).toBeNull();

    act(() => {
      result.current.cancelNewCase();
    });

    expect(result.current.currentView).toBe("details");
    expect(result.current.selectedCaseId).toBe(existingCase.id);

    const lastMeasurement = getLastMeasurementMetadata("navigation:cancelNewCase");
    expect(lastMeasurement).toMatchObject({ result: "details" });
  });

  it("returns to the prior non-intake source after opening a created case", () => {
    // ARRANGE
    const existingCase = createMockStoredCase({ id: "case-origin" });
    const createdCase = createMockStoredCase({ id: "case-created" });
    const { result } = renderNavigationFlow({
      cases: [existingCase, createdCase],
    });

    // ACT
    act(() => {
      result.current.navigate("list");
    });

    expect(result.current.currentView).toBe("list");

    act(() => {
      result.current.viewCase(existingCase.id);
    });

    act(() => {
      result.current.newCase();
    });

    act(() => {
      result.current.completeNewCase(createdCase.id);
    });

    expect(result.current.currentView).toBe("details");
    expect(result.current.selectedCaseId).toBe(createdCase.id);

    act(() => {
      result.current.backToList();
    });

    // ASSERT
    expect(result.current.currentView).toBe("list");
    expect(result.current.selectedCaseId).toBeNull();

    const lastMeasurement = getLastMeasurementMetadata("navigation:completeNewCase");
    expect(lastMeasurement).toMatchObject({
      caseId: createdCase.id,
      result: "details",
      source: "list",
    });
  });

  it("does not navigate when completeNewCase cannot resolve the case", () => {
    // ARRANGE
    const { result } = renderNavigationFlow();

    // ACT
    act(() => {
      result.current.completeNewCase("missing-case");
    });

    // ASSERT
    expect(result.current.currentView).toBe("dashboard");
    expect(result.current.selectedCaseId).toBeNull();

    const lastMeasurement = getLastMeasurementMetadata("navigation:completeNewCase");
    expect(lastMeasurement).toMatchObject({
      caseId: "missing-case",
      result: "missing-case",
    });
  });

  it("navigates to list even when details source state is stale from dashboard", () => {
    const existingCase = createMockStoredCase({ id: "case-1" });
    const { result } = renderNavigationFlow({
      cases: [existingCase],
    });

    act(() => {
      result.current.viewCase(existingCase.id);
    });

    expect(result.current.currentView).toBe("details");

    act(() => {
      result.current.navigate("dashboard");
    });

    expect(result.current.currentView).toBe("dashboard");
    expect(result.current.detailsSourceView).toBe("dashboard");

    act(() => {
      result.current.navigate("list");
    });

    expect(result.current.currentView).toBe("list");
    expect(result.current.detailsSourceView).toBeUndefined();
    expect(result.current.selectedCaseId).toBeNull();
  });

  it("navigates to case details after creating a new case", async () => {
    const newCase = createMockStoredCase({ id: "new-case-id" });
    const personForm = createMockNewPersonData();
    const caseRecordForm = createMockNewCaseRecordData();
    const { result, saveCase } = renderNavigationFlow({
      saveCase: createSaveCaseMock(newCase),
    });

    // newCase() now navigates to intake, not the modal
    act(() => {
      result.current.newCase();
    });

    expect(result.current.currentView).toBe("intake");
    expect(result.current.showNewCaseModal).toBe(false);

    await act(async () => {
      await result.current.saveCaseWithNavigation({
        person: personForm,
        caseRecord: caseRecordForm,
      });
    });

    expect(saveCase).toHaveBeenCalledWith({
      person: personForm,
      caseRecord: caseRecordForm,
    });

    // Modal should remain closed after save
    expect(result.current.showNewCaseModal).toBe(false);
    // Should navigate to the new case details
    expect(result.current.currentView).toBe("details");
    expect(result.current.selectedCaseId).toBe(newCase.id);

    const lastMeasurement = getLastMeasurementMetadata("navigation:saveCase");
    expect(lastMeasurement).toMatchObject({ result: "create" });
  });

  it("uses the originating source when saveCaseWithNavigation creates a case from intake", async () => {
    const existingCase = createMockStoredCase({ id: "case-origin" });
    const newCase = createMockStoredCase({ id: "new-case-id" });
    const personForm = createMockNewPersonData();
    const caseRecordForm = createMockNewCaseRecordData();
    const { result } = renderNavigationFlow({
      cases: [existingCase, newCase],
      saveCase: createSaveCaseMock(newCase),
    });

    act(() => {
      result.current.navigate("list");
    });

    act(() => {
      result.current.viewCase(existingCase.id);
    });

    act(() => {
      result.current.newCase();
    });

    await act(async () => {
      await result.current.saveCaseWithNavigation({
        person: personForm,
        caseRecord: caseRecordForm,
      });
    });

    expect(result.current.currentView).toBe("details");
    expect(result.current.selectedCaseId).toBe(newCase.id);

    act(() => {
      result.current.backToList();
    });

    expect(result.current.currentView).toBe("list");
    expect(result.current.selectedCaseId).toBeNull();
  });

  it("routes newly quick-added cases into intake after save", async () => {
    const quickAddedCase = createMockStoredCase({
      id: "quick-add-case",
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        intakeCompleted: false,
      },
    });
    const personForm = createMockNewPersonData();
    const caseRecordForm = createMockNewCaseRecordData({ intakeCompleted: false });
    const { result } = renderNavigationFlow({
      saveCase: createSaveCaseMock(quickAddedCase),
    });

    act(() => {
      result.current.quickAdd();
    });

    await act(async () => {
      await result.current.saveCaseWithNavigation({
        person: personForm,
        caseRecord: caseRecordForm,
      });
    });

    expect(result.current.showNewCaseModal).toBe(false);
    expect(result.current.currentView).toBe("intake");
    expect(result.current.selectedCaseId).toBe(quickAddedCase.id);
    expect(endMeasurementMock).toHaveBeenCalledWith(
      "navigation:completeNewCase",
      expect.objectContaining({ caseId: quickAddedCase.id, result: "intake" }),
    );
  });
});
