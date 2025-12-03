import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockCaseDisplay } from "@/src/test/testUtils";
import type { AlertsIndex } from "@/utils/alertsData";
import type { AppView } from "@/types/view";
import type { CaseWorkspaceProps } from "@/components/app/CaseWorkspace";
import type { CaseCategory } from "@/types/case";

const viewRendererSpy = vi.fn();

vi.mock("@/components/app/AppNavigationShell", () => ({
  AppNavigationShell: ({ children }: any) => (
    <div data-testid="app-navigation-shell">{children}</div>
  ),
}));

vi.mock("@/components/routing/ViewRenderer", () => ({
  ViewRenderer: (props: any) => {
    viewRendererSpy(props);
    return <div data-testid="view-renderer">view:{props.currentView}</div>;
  },
}));

vi.mock("@/components/modals/FinancialItemModal", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="financial-item-modal">
      modal-category:{props.itemType}
    </div>
  ),
}));

describe("CaseWorkspace", () => {
  const navigation = {
    currentView: "list" as AppView,
    breadcrumbTitle: "Cases",
    sidebarOpen: true,
    onNavigate: vi.fn(),
    onNewCase: vi.fn(),
    onSidebarOpenChange: vi.fn(),
  };

  const alertsIndex: AlertsIndex = {
    alerts: [],
    alertsByCaseId: new Map(),
    summary: { total: 0, matched: 0, unmatched: 0, missingMcn: 0 },
    unmatched: [],
    missingMcn: [],
  };

  const activityLogState = {
    activityLog: [],
    dailyReports: [],
    todayReport: null,
    yesterdayReport: null,
    loading: false,
    error: null,
    refreshActivityLog: vi.fn(),
    getReportForDate: vi.fn(),
    clearReportForDate: vi.fn(),
  };

  const asyncVoid = () => vi.fn(async (..._args: any[]) => undefined);

  const baseViewHandlers: CaseWorkspaceProps["viewHandlers"] = {
    handleViewCase: vi.fn(),
    handleEditCase: vi.fn(),
    handleNewCase: vi.fn(),
    handleBackToList: vi.fn(),
    handleSaveCase: asyncVoid(),
    handleCancelForm: vi.fn(),
    handleDeleteCase: asyncVoid(),
    handleDeleteCases: vi.fn(async () => 0),
    handleUpdateCasesStatus: vi.fn(async () => 0),
    handleUpdateCasesPriority: vi.fn(async () => 0),
    handleDataPurged: asyncVoid(),
  };

  const baseFinancialFlow: CaseWorkspaceProps["financialFlow"] = {
    itemForm: { isOpen: false },
    formData: {
      id: null,
      description: "",
      location: "",
      accountNumber: "",
      amount: 0,
      frequency: "monthly",
      owner: "applicant",
      verificationStatus: "Needs VR",
      verificationSource: "",
      notes: "",
      dateAdded: new Date().toISOString(),
    },
    formErrors: {},
    addAnother: false,
    isEditing: false,
    handleAddItem: vi.fn(),
    handleDeleteItem: asyncVoid(),
    handleBatchUpdateItem: asyncVoid(),
    handleCreateItem: asyncVoid(),
    handleCancelItemForm: vi.fn(),
    handleSaveItem: vi.fn(async () => true),
    updateFormField: vi.fn(),
    setAddAnother: vi.fn(),
  };

  beforeEach(() => {
    viewRendererSpy.mockClear();
  });

  it("renders the error banner with Alert component and dismisses it", async () => {
    const onDismissError = vi.fn();
    const { CaseWorkspace } = await import("@/components/app/CaseWorkspace");

    render(
      <CaseWorkspace
        navigation={navigation}
        cases={[createMockCaseDisplay()]}
        selectedCase={null}
        editingCase={null}
        error="Something went wrong"
        onDismissError={onDismissError}
        viewHandlers={baseViewHandlers}
        financialFlow={baseFinancialFlow}
        alerts={alertsIndex}
        onUpdateCaseStatus={vi.fn()}
        activityLogState={activityLogState}
      />,
    );

    // Verify Alert component structure with proper semantics
    const alert = screen.getByRole("alert");
    expect(alert).toBeVisible();
    expect(alert).toHaveClass("bg-card");

    // Verify error message is present
    expect(screen.getByText("Something went wrong")).toBeVisible();

    // Verify Dismiss button is present and functional
    const dismissButton = screen.getByRole("button", { name: /Dismiss/i });
    expect(dismissButton).toBeVisible();

    await userEvent.click(dismissButton);

    expect(onDismissError).toHaveBeenCalledTimes(1);
  });

  it("opens financial modal when requested", async () => {
    const { CaseWorkspace } = await import("@/components/app/CaseWorkspace");

    const financialFlow = {
      ...baseFinancialFlow,
      itemForm: { isOpen: true, category: 'income' as CaseCategory },
    };

    render(
      <CaseWorkspace
        navigation={navigation}
        cases={[createMockCaseDisplay()]}
        selectedCase={createMockCaseDisplay()}
        editingCase={null}
        error={null}
        onDismissError={vi.fn()}
        viewHandlers={baseViewHandlers}
        financialFlow={financialFlow}
        alerts={alertsIndex}
        onUpdateCaseStatus={vi.fn()}
        activityLogState={activityLogState}
      />,
    );

    expect(await screen.findByTestId("financial-item-modal")).toHaveTextContent("modal-category:income");
  });
});
