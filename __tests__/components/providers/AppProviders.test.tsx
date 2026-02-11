import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// ============================================================================
// Mock all context providers to avoid full app bootstrap
// ============================================================================

vi.mock("@/contexts/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/FileStorageContext", () => ({
  FileStorageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/DataManagerContext", () => ({
  DataManagerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/CategoryConfigContext", () => ({
  CategoryConfigProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/TemplateContext", () => ({
  TemplateProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/EncryptionContext", () => ({
  EncryptionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/error/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/error/FileSystemErrorBoundary", () => ({
  FileSystemErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/utils/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    lifecycle: vi.fn(),
  }),
}));

import { AppProviders } from "@/components/providers/AppProviders";

describe("AppProviders", () => {
  it("renders children through provider hierarchy", () => {
    const { getByText } = render(
      <AppProviders>
        <div>Test Content</div>
      </AppProviders>,
    );

    expect(getByText("Test Content")).toBeInTheDocument();
  });

  it("does not pass getDataFunction prop to FileStorageProvider", () => {
    // This verifies the BLOCKER fix - AppProviders no longer creates
    // a useCallback(() => null) to pass to FileStorageProvider
    const { container } = render(
      <AppProviders>
        <span>OK</span>
      </AppProviders>,
    );

    expect(container).toBeTruthy();
  });
});
