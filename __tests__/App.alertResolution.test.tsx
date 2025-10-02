import React from "react";
import { render, act, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AlertWithMatch } from "@/utils/alertsData";
import { buildAlertStorageKey, createEmptyAlertsIndex } from "@/utils/alertsData";
import type { CaseDisplay } from "@/types/case";

let dataManagerMock: any = {};
let caseManagementMock: any = {};
let navigationFlowMock: any = {};
let connectionFlowMock: any = {};
let financialItemFlowMock: any = {};
let noteFlowMock: any = {};
let importListenersMock: any = vi.fn();
let capturedViewProps: any = null;
let setConfigFromFileMock: ReturnType<typeof vi.fn> = vi.fn();

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(() => "toast-id"),
}));

const fileStorageMock = {
  isSupported: true,
  hasStoredHandle: false,
  connectToFolder: vi.fn(),
  connectToExisting: vi.fn(),
  loadExistingData: vi.fn(),
  service: null,
};

const lifecycleSelectorsMock = {
  permissionStatus: "granted",
  lifecycle: "ready",
  isReady: true,
};

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("/workspaces/CMSNext/utils/logger.ts", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    lifecycle: vi.fn(),
  }),
}));

vi.mock("/workspaces/CMSNext/components/providers/AppProviders.tsx", () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("/workspaces/CMSNext/components/providers/FileStorageIntegrator.tsx", () => ({
  FileStorageIntegrator: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("/workspaces/CMSNext/components/ui/sonner.tsx", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock("/workspaces/CMSNext/components/app/AppContentView.tsx", () => ({
  AppContentView: (props: any) => {
    capturedViewProps = props;
    return <div data-testid="app-content-view" />;
  },
}));

vi.mock("/workspaces/CMSNext/components/app/useAppContentViewModel.ts", () => ({
  useAppContentViewModel: (args: any) => args,
}));

vi.mock("/workspaces/CMSNext/contexts/CategoryConfigContext.tsx", () => ({
  useCategoryConfig: () => ({
    setConfigFromFile: (...args: unknown[]) => setConfigFromFileMock(...args),
  }),
}));

vi.mock("/workspaces/CMSNext/contexts/FileStorageContext.tsx", () => ({
  useFileStorage: () => fileStorageMock,
  useFileStorageLifecycleSelectors: () => lifecycleSelectorsMock,
}));

vi.mock("/workspaces/CMSNext/contexts/DataManagerContext.tsx", () => ({
  useDataManagerSafe: () => dataManagerMock,
}));

vi.mock("/workspaces/CMSNext/hooks/index.ts", () => ({
  useCaseManagement: () => caseManagementMock,
  useConnectionFlow: () => connectionFlowMock,
  useFinancialItemFlow: () => financialItemFlowMock,
  useNavigationFlow: () => navigationFlowMock,
  useNoteFlow: () => noteFlowMock,
  useImportListeners: (args: unknown) => importListenersMock(args),
}));

import App from "@/App";

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
    severity: overrides.severity ?? "High",
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
  beforeEach(() => {
  capturedViewProps = null;

    Object.values(toastMock).forEach(mockFn => mockFn.mockClear());

    Object.assign(fileStorageMock, {
      isSupported: true,
      hasStoredHandle: false,
      connectToFolder: vi.fn(),
      connectToExisting: vi.fn(),
      loadExistingData: vi.fn(),
      service: null,
    });

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
      navigationLock: null,
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

    importListenersMock = vi.fn();
    setConfigFromFileMock = vi.fn();
  });

  afterEach(() => {
    cleanup();
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
