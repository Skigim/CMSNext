import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Settings } from "@/components/app/Settings";
import { createMockCaseDisplay, type CaseDisplayOverrides } from "@/src/test/testUtils";
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
    tone: "light",
    isDark: false,
    toggleTheme: vi.fn(),
    setTheme: vi.fn(),
    themeOptions: [
      { id: "light", name: "Light", description: "Light theme" },
      { id: "dark", name: "Dark", description: "Dark theme" },
    ],
  }),
}));

vi.mock("@/contexts/DataManagerContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/DataManagerContext")>();
  return {
    ...actual,
    useDataManagerSafe: () => ({
      clearAllData: vi.fn(),
    }),
  };
});

vi.mock("@/contexts/CategoryConfigContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/CategoryConfigContext")>();
  return {
    ...actual,
    useCategoryConfig: () => ({
      config: mergeCategoryConfig(),
      loading: false,
      error: null,
      refresh: vi.fn(),
      updateCategory: vi.fn(),
      resetToDefaults: vi.fn(),
      setConfigFromFile: vi.fn(),
    }),
  };
});

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

const createCase = (overrides: CaseDisplayOverrides = {}) =>
  createMockCaseDisplay(overrides);

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
    const secondCase = createCase({
      id: "case-2",
      caseRecord: {
        id: "case-record-2",
      },
    });
    const testCases = [firstCase, secondCase];

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement");
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL");

    const anchor = originalCreateElement("a");
    const clickSpy = vi.spyOn(anchor, "click").mockImplementation(() => {});
    const removeSpy = vi.spyOn(anchor, "remove").mockImplementation(() => {});

    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === "a") {
        return anchor;
      }
      return originalCreateElement(tagName);
    });

    render(<Settings cases={testCases} />);

    const exportButton = screen.getByRole("button", { name: /export json/i });
    expect(exportButton).toBeEnabled();

    await user.click(exportButton);

    expect(appendChildSpy).toHaveBeenCalledWith(anchor);
    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      `Successfully exported ${testCases.length} cases to JSON file`,
    );

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
