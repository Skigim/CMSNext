import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseDisplay } from "@/types/case";
import { useCaseManagement } from "@/hooks/useCaseManagement";

const mockCaseService = vi.hoisted(() => ({
  loadCases: vi.fn(),
  saveCase: vi.fn(),
  deleteCase: vi.fn(),
  saveNote: vi.fn(),
  importCases: vi.fn(),
  updateCaseStatus: vi.fn(),
}));

const mockAppState = vi.hoisted(() => ({
  getCases: vi.fn(() => [] as CaseDisplay[]),
  getCasesLoading: vi.fn(() => false),
  getCasesError: vi.fn(() => null as string | null),
  getHasLoadedCases: vi.fn(() => false),
}));

vi.mock("@/contexts/CaseServiceContext", () => ({
  useCaseService: () => mockCaseService,
}));

vi.mock("@/application/hooks/useApplicationState", () => ({
  useApplicationState: (selector: (state: typeof mockAppState) => unknown) => selector(mockAppState),
}));

vi.mock("@/application/services/caseLegacyMapper", () => ({
  caseToLegacyCaseDisplay: (value: unknown) => value,
}));

describe("useCaseManagement", () => {
  beforeEach(() => {
    mockCaseService.loadCases.mockReset();
    mockCaseService.saveCase.mockReset();
    mockCaseService.deleteCase.mockReset();
    mockCaseService.saveNote.mockReset();
    mockCaseService.importCases.mockReset();
    mockCaseService.updateCaseStatus.mockReset();

    mockAppState.getCases.mockReturnValue([
      {
        id: "case-1",
        name: "Example",
      } as CaseDisplay,
    ]);
    mockAppState.getCasesLoading.mockReturnValue(true);
  mockAppState.getCasesError.mockReturnValue("oops");
    mockAppState.getHasLoadedCases.mockReturnValue(true);
  });

  it("exposes projections from ApplicationState", () => {
    const { result } = renderHook(() => useCaseManagement());

    expect(result.current.cases).toEqual([
      {
        id: "case-1",
        name: "Example",
      },
    ]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe("oops");
    expect(result.current.hasLoadedData).toBe(true);
  });

  it("delegates loadCases to the service", async () => {
    mockCaseService.loadCases.mockResolvedValue([{ id: "case-2" } as CaseDisplay]);

    const { result } = renderHook(() => useCaseManagement());
    const response = await result.current.loadCases();

    expect(mockCaseService.loadCases).toHaveBeenCalledTimes(1);
    expect(response).toEqual([{ id: "case-2" }]);
  });

  it("delegates updateCaseStatus to the service and returns the result", async () => {
    const updatedCase = { id: "case-1", status: "Active" } as CaseDisplay;
    mockCaseService.updateCaseStatus.mockResolvedValue(updatedCase);

    const { result } = renderHook(() => useCaseManagement());
    const response = await result.current.updateCaseStatus("case-1", "Active");

    expect(mockCaseService.updateCaseStatus).toHaveBeenCalledWith("case-1", "Active");
    expect(response).toBe(updatedCase);
  });

  it("forwards deleteCase calls to the service", async () => {
    mockCaseService.deleteCase.mockResolvedValue(undefined);

    const { result } = renderHook(() => useCaseManagement());
    await act(async () => {
      await result.current.deleteCase("case-9");
    });

    expect(mockCaseService.deleteCase).toHaveBeenCalledWith("case-9");
  });
});
