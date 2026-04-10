import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Settings } from "@/components/app/Settings";
import { createMockCaseDisplay } from "@/src/test/testUtils";
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
    }),
  };
});

vi.mock("@/hooks", () => ({
  useAppViewState: () => ({
    featureFlags: {
      "settings.devTools": false,
    },
  }),
  useAlertsCsvImport: () => ({
    isImporting: false,
    fileInputRef: { current: null },
    handleButtonClick: vi.fn(),
    handleFileSelected: vi.fn(),
  }),
}));

vi.mock("@/components/modals/ImportModal", () => ({
  ImportModal: () => null,
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

vi.mock("@/components/category/CategoryManagerPanel", () => ({
  CategoryManagerPanel: () => <div data-testid="category-manager-panel" />,
}));

vi.mock("@/components/alerts/AlertsPreviewPanel", () => ({
  AlertsPreviewPanel: () => <div data-testid="alerts-preview" />,
}));

vi.mock("@/components/settings/PaperCutsPanel", () => ({
  PaperCutsPanel: () => <div data-testid="paper-cuts-panel" />,
}));

vi.mock("@/components/settings/KeyboardShortcutsPanel", () => ({
  KeyboardShortcutsPanel: () => <div data-testid="keyboard-shortcuts-panel" />,
}));

vi.mock("@/components/settings/TemplatesPanel", () => ({
  TemplatesPanel: () => <div data-testid="templates-panel" />,
}));

vi.mock("@/components/settings/ArchivalSettingsPanel", () => ({
  ArchivalSettingsPanel: () => <div data-testid="archival-settings-panel" />,
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

describe("Settings migration surfaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render migration panels in storage settings", async () => {
    // ARRANGE
    const user = userEvent.setup();

    render(<Settings cases={[createMockCaseDisplay()]} />);

    // ACT
    await user.click(screen.getByRole("tab", { name: /storage/i }));

    // ASSERT
    expect(screen.queryByText(/workspace migration/i)).toBeNull();
    expect(screen.queryByText(/legacy migration/i)).toBeNull();
  });
});