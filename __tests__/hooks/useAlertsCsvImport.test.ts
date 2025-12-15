import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAlertsCsvImport } from "@/hooks/useAlertsCsvImport";
import { toast } from "sonner";
import type { DataManager } from "@/utils/DataManager";
import type { StoredCase } from "@/types/case";
import type { AlertsIndex } from "@/utils/alertsData";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

/**
 * Helper to create a mock file with proper .text() method
 */
function createMockFile(content: string, name: string): File {
  const file = new File([content], name, { type: "text/csv" });
  // Override text() to return the content directly
  file.text = vi.fn().mockResolvedValue(content);
  return file;
}

/**
 * Helper to create a mock change event
 */
function createMockEvent(file: File): React.ChangeEvent<HTMLInputElement> {
  return {
    target: {
      files: [file],
      value: file.name,
    },
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

describe("useAlertsCsvImport", () => {
  // Use minimal mock - only fields the hook actually uses
  const mockCases = [
    { id: "case-1", mcn: "MCN001" },
  ] as unknown as StoredCase[];

  const mockAlertsIndex: AlertsIndex = {
    alerts: [],
    summary: { total: 0, matched: 0, unmatched: 0, missingMcn: 0 },
    alertsByCaseId: new Map(),
    unmatched: [],
    missingMcn: [],
  };

  let mockDataManager: Partial<DataManager>;
  let mockOnAlertsCsvImported: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDataManager = {
      mergeAlertsFromCsvContent: vi.fn().mockResolvedValue({
        added: 5,
        updated: 2,
        total: 10,
      }),
      getAlertsIndex: vi.fn().mockResolvedValue(mockAlertsIndex),
    };

    mockOnAlertsCsvImported = vi.fn();
  });

  it("returns initial state with isImporting false", () => {
    const { result } = renderHook(() =>
      useAlertsCsvImport({
        dataManager: mockDataManager as DataManager,
        cases: mockCases,
        onAlertsCsvImported: mockOnAlertsCsvImported,
      })
    );

    expect(result.current.isImporting).toBe(false);
    expect(result.current.fileInputRef.current).toBe(null);
  });

  it("shows error toast when clicking button without dataManager", () => {
    const { result } = renderHook(() =>
      useAlertsCsvImport({
        dataManager: null,
        cases: mockCases,
        onAlertsCsvImported: mockOnAlertsCsvImported,
      })
    );

    act(() => {
      result.current.handleButtonClick();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Connect a storage folder before importing alerts."
    );
  });

  it("handles empty file gracefully", async () => {
    const { result } = renderHook(() =>
      useAlertsCsvImport({
        dataManager: mockDataManager as DataManager,
        cases: mockCases,
        onAlertsCsvImported: mockOnAlertsCsvImported,
      })
    );

    const mockFile = createMockFile("", "empty.csv");
    const mockEvent = createMockEvent(mockFile);

    await act(async () => {
      await result.current.handleFileSelected(mockEvent);
    });

    expect(toast.info).toHaveBeenCalledWith("No alerts detected", {
      description: "empty.csv is empty.",
    });
  });

  it("imports CSV and shows success toast", async () => {
    const { result } = renderHook(() =>
      useAlertsCsvImport({
        dataManager: mockDataManager as DataManager,
        cases: mockCases,
        onAlertsCsvImported: mockOnAlertsCsvImported,
      })
    );

    const csvContent = "MCN,Alert,Date\nMCN001,Test Alert,2024-01-01";
    const mockFile = createMockFile(csvContent, "alerts.csv");
    const mockEvent = createMockEvent(mockFile);

    await act(async () => {
      await result.current.handleFileSelected(mockEvent);
    });

    expect(mockDataManager.mergeAlertsFromCsvContent).toHaveBeenCalledWith(
      csvContent,
      {
        cases: mockCases,
        sourceFileName: "alerts.csv",
      }
    );
    expect(mockDataManager.getAlertsIndex).toHaveBeenCalledWith({ cases: mockCases });
    expect(mockOnAlertsCsvImported).toHaveBeenCalledWith(mockAlertsIndex);
    expect(toast.success).toHaveBeenCalledWith("Alerts updated", {
      description: "5 new · 2 updated • 10 total alerts saved",
    });
  });

  it("shows info toast when no new alerts found", async () => {
    (mockDataManager.mergeAlertsFromCsvContent as Mock).mockResolvedValue({
      added: 0,
      updated: 0,
      total: 10,
    });

    const { result } = renderHook(() =>
      useAlertsCsvImport({
        dataManager: mockDataManager as DataManager,
        cases: mockCases,
        onAlertsCsvImported: mockOnAlertsCsvImported,
      })
    );

    const csvContent = "MCN,Alert,Date\nMCN001,Test Alert,2024-01-01";
    const mockFile = createMockFile(csvContent, "alerts.csv");
    const mockEvent = createMockEvent(mockFile);

    await act(async () => {
      await result.current.handleFileSelected(mockEvent);
    });

    expect(toast.info).toHaveBeenCalledWith("No new alerts found", {
      description: "alerts.csv didn't include new or updated alerts. Still tracking 10 alerts.",
    });
  });

  it("handles import errors gracefully", async () => {
    const errorMessage = "Invalid CSV format";
    (mockDataManager.mergeAlertsFromCsvContent as Mock).mockRejectedValue(
      new Error(errorMessage)
    );

    const { result } = renderHook(() =>
      useAlertsCsvImport({
        dataManager: mockDataManager as DataManager,
        cases: mockCases,
        onAlertsCsvImported: mockOnAlertsCsvImported,
      })
    );

    const csvContent = "invalid csv content";
    const mockFile = createMockFile(csvContent, "bad.csv");
    const mockEvent = createMockEvent(mockFile);

    await act(async () => {
      await result.current.handleFileSelected(mockEvent);
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to import alerts", {
      description: errorMessage,
    });
    expect(result.current.isImporting).toBe(false);
  });

  it("does nothing when no file selected", async () => {
    const { result } = renderHook(() =>
      useAlertsCsvImport({
        dataManager: mockDataManager as DataManager,
        cases: mockCases,
        onAlertsCsvImported: mockOnAlertsCsvImported,
      })
    );

    const mockEvent = {
      target: {
        files: [],
        value: "",
      },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleFileSelected(mockEvent);
    });

    expect(mockDataManager.mergeAlertsFromCsvContent).not.toHaveBeenCalled();
    expect(result.current.isImporting).toBe(false);
  });
});
