import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { FileStorageLifecycleSelectors } from "@/contexts/FileStorageContext";
import type { NewCaseRecordData, NewPersonData } from "@/types/case";
import { createMockStoredCase, toast as mockToast } from "@/src/test/testUtils";

vi.mock("@/utils/performanceTracker", () => ({
  startMeasurement: vi.fn(),
  endMeasurement: vi.fn(),
}));

import { useNavigationFlow } from "@/hooks/useNavigationFlow";
import { startMeasurement, endMeasurement } from "@/utils/performanceTracker";
const startMeasurementMock = vi.mocked(startMeasurement);
const endMeasurementMock = vi.mocked(endMeasurement);

function createConnectionState(
  overrides: Partial<FileStorageLifecycleSelectors> = {},
): FileStorageLifecycleSelectors {
  return {
    lifecycle: "ready",
    permissionStatus: "granted",
    isReady: true,
    isBlocked: false,
    isErrored: false,
    isRecovering: false,
    isAwaitingUserChoice: false,
    hasStoredHandle: true,
    isConnected: true,
    lastError: null,
    ...overrides,
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
    const saveCase = vi.fn().mockResolvedValue(undefined);
    const deleteCase = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(({ connectionState }) =>
      useNavigationFlow({
        cases: [existingCase],
        connectionState,
        saveCase,
        deleteCase,
      }),
    {
      initialProps: {
        connectionState: createConnectionState(),
      },
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
      expect.objectContaining({ caseId: existingCase.id, blocked: false }),
    );
  });

  it("blocks restricted navigation when storage is locked", async () => {
    const existingCase = createMockStoredCase({ id: "case-locked" });
    const saveCase = vi.fn().mockResolvedValue(undefined);
    const deleteCase = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(({ connectionState }) =>
      useNavigationFlow({
        cases: [existingCase],
        connectionState,
        saveCase,
        deleteCase,
      }),
    {
      initialProps: {
        connectionState: createConnectionState({
          isBlocked: true,
          isReady: false,
          permissionStatus: "denied",
        }),
      },
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
    const saveCase = vi.fn().mockResolvedValue(existingCase);
    const deleteCase = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(({ connectionState }) =>
      useNavigationFlow({
        cases: [existingCase],
        connectionState,
        saveCase,
        deleteCase,
      }),
    {
      initialProps: {
        connectionState: createConnectionState(),
      },
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

  it("returns to the originating details view when intake is canceled", () => {
    const existingCase = createMockStoredCase({ id: "case-origin" });
    const saveCase = vi.fn().mockResolvedValue(undefined);
    const deleteCase = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(({ connectionState }) =>
      useNavigationFlow({
        cases: [existingCase],
        connectionState,
        saveCase,
        deleteCase,
      }),
    {
      initialProps: {
        connectionState: createConnectionState(),
      },
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
    const existingCase = createMockStoredCase({ id: "case-origin" });
    const createdCase = createMockStoredCase({ id: "case-created" });
    const saveCase = vi.fn().mockResolvedValue(undefined);
    const deleteCase = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(({ connectionState }) =>
      useNavigationFlow({
        cases: [existingCase, createdCase],
        connectionState,
        saveCase,
        deleteCase,
      }),
    {
      initialProps: {
        connectionState: createConnectionState(),
      },
    });

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

    expect(result.current.currentView).toBe("list");
    expect(result.current.selectedCaseId).toBeNull();

    const lastMeasurement = getLastMeasurementMetadata("navigation:completeNewCase");
    expect(lastMeasurement).toMatchObject({
      caseId: createdCase.id,
      result: "details",
      source: "list",
    });
  });

  it("navigates to case details after creating a new case", async () => {
    const newCase = createMockStoredCase({ id: "new-case-id" });
    const saveCase = vi.fn().mockResolvedValue(newCase);
    const deleteCase = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(({ connectionState }) =>
      useNavigationFlow({
        cases: [],
        connectionState,
        saveCase,
        deleteCase,
      }),
    {
      initialProps: {
        connectionState: createConnectionState(),
      },
    });

    // newCase() now navigates to intake, not the modal
    act(() => {
      result.current.newCase();
    });

    expect(result.current.currentView).toBe("intake");
    expect(result.current.showNewCaseModal).toBe(false);

    const personForm: NewPersonData = {
      firstName: "Casey",
      lastName: "Tester",
      email: "casey@example.com",
      phone: "555-0101",
      dateOfBirth: "1990-01-01",
      ssn: "123-45-6789",
      livingArrangement: "Home",
      status: "Active",
      address: {
        street: "123 Main St",
        city: "Test City",
        state: "TC",
        zip: "12345",
      },
      mailingAddress: {
        street: "123 Main St",
        city: "Test City",
        state: "TC",
        zip: "12345",
        sameAsPhysical: true,
      },
      organizationId: null,
      authorizedRepIds: [],
      familyMembers: [],
    };

    const caseRecordForm: NewCaseRecordData = {
      mcn: "MCN-0001",
      applicationDate: "2024-01-01",
      caseType: "Sample",
      personId: "temp-person-id",
      spouseId: "",
      status: "Pending",
      description: "Test case",
      priority: false,
      livingArrangement: "Home",
      withWaiver: false,
      admissionDate: "2024-01-05",
      organizationId: "org-1",
      authorizedReps: [],
      retroRequested: "",
    };

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
    const saveCase = vi.fn().mockResolvedValue(newCase);
    const deleteCase = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(({ connectionState }) =>
      useNavigationFlow({
        cases: [existingCase, newCase],
        connectionState,
        saveCase,
        deleteCase,
      }),
    {
      initialProps: {
        connectionState: createConnectionState(),
      },
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
        person: {
          firstName: "Casey",
          lastName: "Tester",
          email: "casey@example.com",
          phone: "555-0101",
          dateOfBirth: "1990-01-01",
          ssn: "123-45-6789",
          livingArrangement: "Home",
          status: "Active",
          address: {
            street: "123 Main St",
            city: "Test City",
            state: "TC",
            zip: "12345",
          },
          mailingAddress: {
            street: "123 Main St",
            city: "Test City",
            state: "TC",
            zip: "12345",
            sameAsPhysical: true,
          },
          organizationId: null,
          authorizedRepIds: [],
          familyMembers: [],
        },
        caseRecord: {
          mcn: "MCN-0001",
          applicationDate: "2024-01-01",
          caseType: "Sample",
          personId: "temp-person-id",
          spouseId: "",
          status: "Pending",
          description: "Test case",
          priority: false,
          livingArrangement: "Home",
          withWaiver: false,
          admissionDate: "2024-01-05",
          organizationId: "org-1",
          authorizedReps: [],
          retroRequested: "",
        },
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
});
