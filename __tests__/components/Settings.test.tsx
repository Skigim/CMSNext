import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Settings } from "@/components/app/Settings";
import type { CaseDisplay } from "@/types/case";
import { mergeCategoryConfig } from "@/types/categoryConfig";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    loading: vi.fn(),
  },
}));

vi.mock("@/contexts/FileStorageContext", () => ({
  useFileStorage: () => ({
    disconnect: vi.fn(),
  }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
    themeOptions: [
      { id: "light", name: "Light", description: "Light theme" },
      { id: "dark", name: "Dark", description: "Dark theme" },
    ],
  }),
}));

vi.mock("@/contexts/DataManagerContext", () => ({
  useDataManagerSafe: () => ({
    clearAllData: vi.fn(),
  }),
}));

vi.mock("@/contexts/CategoryConfigContext", () => ({
  useCategoryConfig: () => ({
    config: mergeCategoryConfig(),
    loading: false,
    error: null,
    refresh: vi.fn(),
    updateCategory: vi.fn(),
    resetToDefaults: vi.fn(),
    setConfigFromFile: vi.fn(),
  }),
}));

vi.mock("@/components/modals/ImportModal", () => ({
  ImportModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="import-modal" /> : null,
}));

vi.mock("@/components/category/CategoryManagerPanel", () => ({
  CategoryManagerPanel: () => (
    <div data-testid="category-manager-panel">Category Manager Panel</div>
  ),
}));

vi.mock("@/components/diagnostics/FileStorageSettings", () => ({
  default: () => <div data-testid="file-storage-settings" />,
}));

vi.mock("@/components/diagnostics/FileStorageDiagnostics", () => ({
  FileStorageDiagnostics: () => <div data-testid="file-storage-diagnostics" />,
}));

vi.mock("@/components/diagnostics/CategoryConfigDevPanel", () => ({
  CategoryConfigDevPanel: () => <div data-testid="category-config-dev" />,
}));

vi.mock("@/components/alerts/AlertsPreviewPanel", () => ({
  AlertsPreviewPanel: () => <div data-testid="alerts-preview" />,
}));

vi.mock("@/components/error/ErrorBoundaryTest", () => ({
  ErrorBoundaryTest: () => <div data-testid="error-boundary-test" />,
}));

vi.mock("@/components/error/ErrorReportViewer", () => ({
  ErrorReportViewer: () => <div data-testid="error-report-viewer" />,
}));

vi.mock("@/components/error/ErrorFeedbackForm", () => ({
  FeedbackPanel: () => <div data-testid="feedback-panel" />,
}));

const createCase = (overrides: Partial<CaseDisplay> = {}): CaseDisplay => {
  const base: CaseDisplay = {
    id: "case-1",
    name: "Test Case",
    mcn: "MCN-001",
    status: "Pending",
    priority: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    person: {
      id: "person-1",
      firstName: "Test",
      lastName: "User",
      name: "Test User",
      email: "test@example.com",
      phone: "555-555-5555",
      dateOfBirth: "1990-01-01",
      ssn: "123-45-6789",
      organizationId: null,
      livingArrangement: "Apartment",
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
      createdAt: "2024-01-01T00:00:00.000Z",
      dateAdded: "2024-01-01T00:00:00.000Z",
    },
    caseRecord: {
      id: "case-record-1",
      mcn: "MCN-001",
      applicationDate: "2024-01-10",
      caseType: "LTC",
      personId: "person-1",
      spouseId: "",
      status: "Pending",
      description: "",
      priority: false,
      livingArrangement: "Apartment",
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
      createdDate: "2024-01-01T00:00:00.000Z",
      updatedDate: "2024-01-01T00:00:00.000Z",
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

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reveals the category manager when the Categories tab is selected", async () => {
    const user = userEvent.setup();
    render(<Settings cases={[createCase()]} />);

    const categoriesTab = screen.getByRole("tab", { name: /categories/i });
    await user.click(categoriesTab);

    expect(screen.getByTestId("category-manager-panel")).toBeVisible();
  });

  it("exports current data as JSON and notifies the user", async () => {
  const user = userEvent.setup();
  const firstCase = createCase();
  const secondCase = createCase();
  secondCase.id = "case-2";
  secondCase.caseRecord.id = "case-record-2";
  const testCases = [firstCase, secondCase];

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement");
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL");

    const anchor = originalCreateElement("a");
    const clickSpy = vi.spyOn(anchor, "click").mockImplementation(() => {});

    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === "a") {
        return anchor as HTMLAnchorElement;
      }
      return originalCreateElement(tagName);
    });

    render(<Settings cases={testCases} />);

    const exportButton = screen.getByRole("button", { name: /export json/i });
    expect(exportButton).toBeEnabled();

    await user.click(exportButton);

    expect(appendChildSpy).toHaveBeenCalledWith(anchor);
    expect(clickSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURLSpy).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      `Successfully exported ${testCases.length} cases to JSON file`,
    );

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
