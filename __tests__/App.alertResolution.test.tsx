import React from "react";
import { render, act, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AlertWithMatch } from "@/utils/alertsData";
import { buildAlertStorageKey, createEmptyAlertsIndex } from "@/utils/alertsData";
import type { CaseDisplay } from "@/types/case";

type AppComponent = (typeof import("@/App"))["default"];

const APP_MODULE_PATH = "@/App";
const LOGGER_MODULE_PATH = "@/utils/logger";
const APP_PROVIDERS_MODULE_PATH = "@/components/providers/AppProviders";
const FILE_STORAGE_INTEGRATOR_MODULE_PATH = "@/components/providers/FileStorageIntegrator";
const TOASTER_MODULE_PATH = "@/components/ui/sonner";
const APP_CONTENT_VIEW_MODULE_PATH = "@/components/app/AppContentView";
const APP_CONTENT_VIEW_MODEL_MODULE_PATH = "@/components/app/useAppContentViewModel";
const CATEGORY_CONFIG_CONTEXT_MODULE_PATH = "@/contexts/CategoryConfigContext";
const FILE_STORAGE_CONTEXT_MODULE_PATH = "@/contexts/FileStorageContext";
const DATA_MANAGER_CONTEXT_MODULE_PATH = "@/contexts/DataManagerContext";
const HOOKS_MODULE_PATH = "@/hooks";

type ToastMock = {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
  loading: ReturnType<typeof vi.fn>;
};

type FileStorageMock = {
  isSupported: boolean;
  hasStoredHandle: boolean;
  connectToFolder: ReturnType<typeof vi.fn>;
  connectToExisting: ReturnType<typeof vi.fn>;
  loadExistingData: ReturnType<typeof vi.fn>;
  service: unknown;
};

type LifecycleSelectorsMock = {
  permissionStatus: string;
  lifecycle: string;
  isReady: boolean;
};

let App: AppComponent;
let toastMock: ToastMock;
let fileStorageMock: FileStorageMock;
let lifecycleSelectorsMock: LifecycleSelectorsMock;
let dataManagerMock: any = {};
let caseManagementMock: any = {};
let navigationFlowMock: any = {};
let connectionFlowMock: any = {};
let financialItemFlowMock: any = {};
let noteFlowMock: any = {};
let activityLogStateMock: any = {};
let dataLoadHandlerSpy: any = vi.fn();
let importListenersMock: ReturnType<typeof vi.fn> = vi.fn();
let capturedViewProps: any = null;
let setConfigFromFileMock: ReturnType<typeof vi.fn> = vi.fn();

const createToastMock = (): ToastMock => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(() => "toast-id"),
});

const createFileStorageMock = (): FileStorageMock => ({
  isSupported: true,
  hasStoredHandle: false,
  connectToFolder: vi.fn(),
  connectToExisting: vi.fn(),
  loadExistingData: vi.fn(),
  service: null,
});

const createLifecycleSelectorsMock = (): LifecycleSelectorsMock => ({
  permissionStatus: "granted",
  lifecycle: "ready",
  isReady: true,
});

function buildTestCase(): CaseDisplay {
  const now = new Date().toISOString();
  return {
    id: "case-123",
    name: "Jane Doe",
    mcn: "MCN12345",
    status: "Active",
    priority: false,
    createdAt: now,
    updatedAt: now,
    person: {
      id: "person-1",
      firstName: "Jane",
      lastName: "Doe",
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "555-0000",
      dateOfBirth: now,
      ssn: "123-45-6789",
      organizationId: null,
      livingArrangement: "",
      address: { street: "", city: "", state: "", zip: "" },
      mailingAddress: { street: "", city: "", state: "", zip: "", sameAsPhysical: true },
      authorizedRepIds: [],
      familyMembers: [],
      status: "Active",
      createdAt: now,
      dateAdded: now,
    },
    caseRecord: {
      id: "record-1",
      mcn: "MCN12345",
      applicationDate: now,
      caseType: "",
      personId: "person-1",
      spouseId: "",
      status: "Active",
      description: "",
      priority: false,
      livingArrangement: "",
      withWaiver: false,
      admissionDate: now,
      organizationId: "",
      authorizedReps: [],
      retroRequested: "",
      financials: {
        resources: [],
        income: [],
        expenses: [],
      },
      notes: [],
      createdDate: now,
      updatedDate: now,
    },
    alerts: [],
  };
}

function buildMatchedAlert(overrides: Partial<AlertWithMatch> = {}): AlertWithMatch {
  const baseTimestamp = "2024-03-01T00:00:00.000Z";
  return {
    id: overrides.id ?? "alert-random-id",
    reportId: overrides.reportId ?? "report-001",
    alertCode: overrides.alertCode ?? "AL-101",
    alertType: overrides.alertType ?? "Recertification",
    alertDate: overrides.alertDate ?? baseTimestamp,
    createdAt: overrides.createdAt ?? baseTimestamp,
    updatedAt: overrides.updatedAt ?? baseTimestamp,
    mcNumber: overrides.mcNumber ?? "MCN12345",
    personName: overrides.personName ?? "Jane Doe",
    program: overrides.program ?? "Medicaid",
    region: overrides.region ?? "Region 1",
    state: overrides.state ?? "NC",
    source: overrides.source ?? "Import",
    description: overrides.description ?? "Follow up with client",
    status: overrides.status ?? "new",
    resolvedAt: overrides.resolvedAt ?? null,
    resolutionNotes: overrides.resolutionNotes,
    metadata: overrides.metadata ?? {},
    matchStatus: overrides.matchStatus ?? "matched",
    matchedCaseId: overrides.matchedCaseId ?? "case-123",
    matchedCaseName: overrides.matchedCaseName ?? "Jane Doe",
    matchedCaseStatus: overrides.matchedCaseStatus ?? "Active",
  };
}

describe("App alert resolution", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    toastMock = createToastMock();
    fileStorageMock = createFileStorageMock();
    lifecycleSelectorsMock = createLifecycleSelectorsMock();
    capturedViewProps = null;

    dataManagerMock = {
      updateAlertStatus: vi.fn().mockResolvedValue(undefined),
      getAlertsIndex: vi.fn().mockResolvedValue(createEmptyAlertsIndex()),
    };

    const testCase = buildTestCase();
    caseManagementMock = {
      cases: [testCase],
      loading: false,
      error: null,
      hasLoadedData: true,
      loadCases: vi.fn(),
      saveCase: vi.fn(),
      deleteCase: vi.fn(),
      updateCaseStatus: vi.fn(),
      setCases: vi.fn(),
      setError: vi.fn(),
      setHasLoadedData: vi.fn(),
    };

    navigationFlowMock = {
      currentView: "case",
      selectedCase: testCase,
      editingCase: null,
      sidebarOpen: false,
      breadcrumbTitle: "Test Case",
      navigate: vi.fn(),
      viewCase: vi.fn(),
      editCase: vi.fn(),
      newCase: vi.fn(),
      saveCaseWithNavigation: vi.fn(),
      cancelForm: vi.fn(),
      deleteCaseWithNavigation: vi.fn(),
      backToList: vi.fn(),
      setSidebarOpen: vi.fn(),
      navigationLock: { locked: false, reason: "", tone: "info" },
    };

    connectionFlowMock = {
      showConnectModal: false,
      handleChooseNewFolder: vi.fn(),
      handleConnectToExisting: vi.fn(),
      dismissConnectModal: vi.fn(),
    };

    financialItemFlowMock = {
      itemForm: null,
      openItemForm: vi.fn(),
      closeItemForm: vi.fn(),
      handleDeleteItem: vi.fn(),
      handleBatchUpdateItem: vi.fn(),
      handleCreateItem: vi.fn(),
    };

    noteFlowMock = {
      noteForm: null,
      handleAddNote: vi.fn(),
      handleEditNote: vi.fn(),
      handleDeleteNote: vi.fn(),
      handleSaveNote: vi.fn(),
      handleCancelNoteForm: vi.fn(),
      handleBatchUpdateNote: vi.fn(),
      handleBatchCreateNote: vi.fn(),
    };

    activityLogStateMock = {
      activityLog: [],
      dailyReports: [],
      todayReport: null,
      yesterdayReport: null,
      loading: false,
      error: null,
      refreshActivityLog: vi.fn().mockResolvedValue(undefined),
      getReportForDate: vi.fn().mockReturnValue({
        date: "2025-01-01",
        totals: { total: 0, statusChanges: 0, notesAdded: 0 },
        entries: [],
        cases: [],
      }),
      clearReportForDate: vi.fn().mockResolvedValue(0),
    };

    dataLoadHandlerSpy = vi.fn();

    importListenersMock = vi.fn();
    setConfigFromFileMock = vi.fn();

    vi.doMock("sonner", () => ({
      toast: toastMock,
    }));

    vi.doMock(LOGGER_MODULE_PATH, () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        lifecycle: vi.fn(),
      }),
    }));

    vi.doMock(APP_PROVIDERS_MODULE_PATH, () => ({
      AppProviders: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }));

    vi.doMock(FILE_STORAGE_INTEGRATOR_MODULE_PATH, () => ({
      FileStorageIntegrator: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }));

    vi.doMock(TOASTER_MODULE_PATH, () => ({
      Toaster: () => <div data-testid="toaster" />,
    }));

    vi.doMock(APP_CONTENT_VIEW_MODULE_PATH, () => ({
      AppContentView: (props: any) => {
        capturedViewProps = props;
        return <div data-testid="app-content-view" />;
      },
    }));

    vi.doMock(APP_CONTENT_VIEW_MODEL_MODULE_PATH, () => ({
      useAppContentViewModel: (args: any) => args,
    }));

    vi.doMock(CATEGORY_CONFIG_CONTEXT_MODULE_PATH, () => ({
      useCategoryConfig: () => ({
        setConfigFromFile: (...args: unknown[]) => setConfigFromFileMock(...args),
      }),
    }));

    vi.doMock(FILE_STORAGE_CONTEXT_MODULE_PATH, () => ({
      useFileStorage: () => fileStorageMock,
      useFileStorageLifecycleSelectors: () => lifecycleSelectorsMock,
      useFileStorageDataLoadHandler: (handler: unknown) => {
        dataLoadHandlerSpy(handler);
      },
    }));

    vi.doMock(DATA_MANAGER_CONTEXT_MODULE_PATH, () => ({
      useDataManagerSafe: () => dataManagerMock,
    }));

    vi.doMock(HOOKS_MODULE_PATH, async () => {
      const actual = await vi.importActual<typeof import("@/hooks")>(HOOKS_MODULE_PATH);
      return {
        ...actual,
        useCaseManagement: () => caseManagementMock,
        useConnectionFlow: () => connectionFlowMock,
        useFinancialItemFlow: () => financialItemFlowMock,
        useNavigationFlow: () => navigationFlowMock,
        useNoteFlow: () => noteFlowMock,
        useImportListeners: (args: unknown) => importListenersMock(args),
        useCaseActivityLog: () => activityLogStateMock,
      };
    });

    ({ default: App } = await import(APP_MODULE_PATH));
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("uses the canonical alert storage key when resolving alerts", async () => {
    render(<App />);

    await waitFor(() => {
      expect(capturedViewProps?.workspaceState?.onResolveAlert).toBeInstanceOf(Function);
    });

    const alert = buildMatchedAlert({
      id: "alert-plain-id",
      reportId: "canonical-report",
      description: "Client interview scheduled",
    });

    const expectedKey = buildAlertStorageKey(alert);
    expect(expectedKey).not.toBeNull();
    expect(expectedKey).not.toBe(alert.id);

    await act(async () => {
      await capturedViewProps.workspaceState.onResolveAlert(alert);
    });

    expect(dataManagerMock.updateAlertStatus).toHaveBeenCalledTimes(1);
    expect(dataManagerMock.updateAlertStatus).toHaveBeenCalledWith(
      expectedKey,
      expect.objectContaining({ status: "resolved" }),
      { cases: caseManagementMock.cases },
    );

    expect(dataManagerMock.getAlertsIndex).toHaveBeenCalledTimes(2);
    const finalGetAlertsCall = dataManagerMock.getAlertsIndex.mock.calls.at(-1);
    expect(finalGetAlertsCall).toEqual([{ cases: caseManagementMock.cases }]);
    expect(toastMock.success).toHaveBeenCalledWith(
      "Alert resolved",
      expect.objectContaining({ description: expect.stringContaining("Add a note") }),
    );

    expect(toastMock.error).not.toHaveBeenCalled();
  });
});
