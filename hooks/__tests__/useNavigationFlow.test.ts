import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNavigationFlow } from "../useNavigationFlow";
import type { FileStorageLifecycleSelectors } from "../../contexts/FileStorageContext";
import type { CaseDisplay } from "../../types/case";

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const sampleCase: CaseDisplay = {
  id: "case-1",
  name: "Sample Case",
  mcn: "MCN-1",
  status: "Pending",
  priority: false,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  person: {
    id: "person-1",
    firstName: "Jane",
    lastName: "Doe",
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "555-123-4567",
    dateOfBirth: "1990-01-01",
    ssn: "123-45-6789",
    organizationId: null,
    livingArrangement: "Home",
    address: {
      street: "1 Main St",
      city: "Springfield",
      state: "IL",
      zip: "62704",
    },
    mailingAddress: {
      street: "1 Main St",
      city: "Springfield",
      state: "IL",
      zip: "62704",
      sameAsPhysical: true,
    },
    authorizedRepIds: [],
    familyMembers: [],
    status: "Active",
    createdAt: "2024-01-01T00:00:00.000Z",
    dateAdded: "2024-01-01T00:00:00.000Z",
  },
  caseRecord: {
    id: "record-1",
    mcn: "MCN-1",
    applicationDate: "2024-01-05",
    caseType: "General",
    personId: "person-1",
    spouseId: "",
  status: "Pending",
    description: "Initial case",
    priority: false,
    livingArrangement: "Home",
    withWaiver: false,
    admissionDate: "2024-01-10",
    organizationId: "org-1",
    authorizedReps: [],
    retroRequested: "No",
    financials: {
      resources: [],
      income: [],
      expenses: [],
    },
    notes: [],
    createdDate: "2024-01-01T00:00:00.000Z",
    updatedDate: "2024-01-01T00:00:00.000Z",
  },
};

const readyConnectionState: FileStorageLifecycleSelectors = {
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
};

const blockedConnectionState: FileStorageLifecycleSelectors = {
  lifecycle: "blocked",
  permissionStatus: "denied",
  isReady: false,
  isBlocked: true,
  isErrored: false,
  isRecovering: false,
  isAwaitingUserChoice: false,
  hasStoredHandle: true,
  isConnected: false,
  lastError: {
    message: "Permission denied",
    timestamp: Date.now(),
  },
};

describe("useNavigationFlow", () => {
  const cases = [sampleCase];
  const saveCase = vi.fn().mockResolvedValue(undefined);
  const deleteCase = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows navigation when storage is ready", () => {
    const { result } = renderHook(() =>
      useNavigationFlow({ cases, connectionState: readyConnectionState, saveCase, deleteCase }),
    );

    act(() => {
      result.current.navigate("list");
    });

    expect(result.current.currentView).toBe("list");
    expect(result.current.navigationLock.locked).toBe(false);
  });

  it("locks case navigation when storage becomes blocked and restores previous view when ready", async () => {
    const { result, rerender } = renderHook(
      ({ connectionState }: { connectionState: FileStorageLifecycleSelectors }) =>
        useNavigationFlow({ cases, connectionState, saveCase, deleteCase }),
      {
        initialProps: { connectionState: readyConnectionState },
      },
    );

    act(() => {
      result.current.navigate("list");
    });

    expect(result.current.currentView).toBe("list");

    await act(async () => {
      rerender({ connectionState: blockedConnectionState });
    });

    await waitFor(() => {
      expect(result.current.currentView).toBe("settings");
    });

    act(() => {
      result.current.viewCase(sampleCase.id);
    });

    expect(result.current.currentView).toBe("settings");
    expect(result.current.selectedCaseId).toBeNull();
    expect(result.current.navigationLock.locked).toBe(true);

    await act(async () => {
      rerender({ connectionState: readyConnectionState });
    });

    await waitFor(() => {
      expect(result.current.currentView).toBe("list");
    });
    expect(result.current.navigationLock.locked).toBe(false);
  });
});
