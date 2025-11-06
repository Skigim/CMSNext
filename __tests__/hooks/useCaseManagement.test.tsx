import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import type { CaseDisplay } from "@/types/case";
import { CaseServiceProvider } from "@/contexts/CaseServiceContext";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastLoading: vi.fn(),
  toastDismiss: vi.fn(),
  useDataManagerSafeMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    loading: mocks.toastLoading,
    dismiss: mocks.toastDismiss,
  },
}));

vi.mock("@/contexts/DataManagerContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/DataManagerContext")>();
  return {
    ...actual,
    useDataManagerSafe: mocks.useDataManagerSafeMock,
  };
});

import { useCaseManagement } from "@/hooks/useCaseManagement";

const createCaseDisplay = (overrides: Partial<CaseDisplay> = {}): CaseDisplay => {
  const base: CaseDisplay = {
    id: "case-1",
    name: "Test Case",
    mcn: "MCN-1",
    status: "Pending",
    priority: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    person: {
      id: "person-1",
      firstName: "Test",
      lastName: "Case",
      name: "Test Case",
      email: "test@example.com",
      phone: "555-555-5555",
      dateOfBirth: "1990-01-01",
      ssn: "111-22-3333",
      organizationId: null,
      livingArrangement: "Apartment/House",
      address: {
        street: "123 Main St",
        city: "Anytown",
        state: "CA",
        zip: "90210",
      },
      mailingAddress: {
        street: "123 Main St",
        city: "Anytown",
        state: "CA",
        zip: "90210",
        sameAsPhysical: true,
      },
      authorizedRepIds: [],
      familyMembers: [],
      status: "Active",
      createdAt: "2025-01-01T00:00:00.000Z",
      dateAdded: "2025-01-01T00:00:00.000Z",
    },
    caseRecord: {
      id: "case-record-1",
      mcn: "MCN-1",
      applicationDate: "2025-01-10",
      caseType: "LTC",
      personId: "person-1",
      spouseId: "",
      status: "Pending",
      description: "",
      priority: false,
      livingArrangement: "Apartment/House",
      withWaiver: false,
      admissionDate: "",
      organizationId: "",
      authorizedReps: [],
      retroRequested: "",
      financials: {
        resources: [],
        income: [],
        expenses: [],
      },
      notes: [],
      createdDate: "2025-01-01T00:00:00.000Z",
      updatedDate: "2025-01-01T00:00:00.000Z",
    },
  };

  return {
    ...base,
    ...overrides,
    person: {
      ...base.person,
      ...(overrides.person ?? {}),
    },
    caseRecord: {
      ...base.caseRecord,
      ...(overrides.caseRecord ?? {}),
    },
  };
};

describe("useCaseManagement", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CaseServiceProvider>{children}</CaseServiceProvider>
  );

  beforeEach(() => {
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    mocks.toastLoading.mockReset();
    mocks.toastDismiss.mockReset();
    mocks.toastLoading.mockImplementation(() => "toast-id");
    mocks.useDataManagerSafeMock.mockReset();
  });

  it("updates case status via DataManager and syncs local state", async () => {
    const initialCase = createCaseDisplay();
    const updatedCase = createCaseDisplay({ status: "Active" });

    const mockDataManager = {
      updateCaseStatus: vi.fn().mockResolvedValue(updatedCase),
    };

  mocks.useDataManagerSafeMock.mockReturnValue(mockDataManager);

    const { result } = renderHook(() => useCaseManagement(), { wrapper });

    act(() => {
      result.current.setCases([initialCase]);
    });

    await act(async () => {
      const returned = await result.current.updateCaseStatus(initialCase.id, "Active");
      expect(returned).toEqual(updatedCase);
    });

    expect(mockDataManager.updateCaseStatus).toHaveBeenCalledWith(initialCase.id, "Active");
    expect(result.current.cases[0]).toEqual(updatedCase);
    expect(mocks.toastLoading).toHaveBeenCalledWith("Updating case status...");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Status updated to Active", {
      id: "toast-id",
      duration: 2000,
    });
  });

  it("returns null and surfaces an error when DataManager is unavailable", async () => {
    mocks.useDataManagerSafeMock.mockReturnValue(null);

    const { result } = renderHook(() => useCaseManagement(), { wrapper });

    await act(async () => {
      const response = await result.current.updateCaseStatus("missing-case", "Active");
      expect(response).toBeNull();
    });

    expect(mocks.toastLoading).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Data storage is not available. Please connect to a folder first.",
    );
  });

  it("handles DataManager update errors gracefully", async () => {
    const initialCase = createCaseDisplay();

    const mockDataManager = {
      updateCaseStatus: vi.fn().mockRejectedValue(new Error("Update failed")),
    };

    mocks.useDataManagerSafeMock.mockReturnValue(mockDataManager);

    const { result } = renderHook(() => useCaseManagement(), { wrapper });

    act(() => {
      result.current.setCases([initialCase]);
    });

    await act(async () => {
      const response = await result.current.updateCaseStatus(initialCase.id, "Closed");
      expect(response).toBeNull();
    });

    expect(mockDataManager.updateCaseStatus).toHaveBeenCalledWith(initialCase.id, "Closed");
    expect(mocks.toastLoading).toHaveBeenCalledWith("Updating case status...");
    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to update case status to Closed"),
      { id: "toast-id" }
    );
  });
});
