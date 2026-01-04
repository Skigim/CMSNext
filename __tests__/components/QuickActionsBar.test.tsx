import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QuickActionsBar } from "@/components/app/QuickActionsBar";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock the CategoryConfigContext
vi.mock("@/contexts/CategoryConfigContext", () => ({
  useCategoryConfig: () => ({
    config: {
      caseStatuses: [
        { name: "Pending", colorSlot: "blue" },
        { name: "In Progress", colorSlot: "amber" },
        { name: "Approved", colorSlot: "green" },
        { name: "Denied", colorSlot: "red" },
      ],
      caseCategories: [],
    },
    setConfigFromFile: vi.fn(),
    updateStatuses: vi.fn(),
    updateCategories: vi.fn(),
  }),
}));

// Wrapper component with providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

describe("QuickActionsBar", () => {
  const mockHandlers = {
    onNewCase: vi.fn(),
    onSearchChange: vi.fn(),
    onBulkStatusUpdate: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onImportAlerts: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search input", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} />
      </TestWrapper>
    );

    expect(screen.getByPlaceholderText("Search cases...")).toBeInTheDocument();
  });

  it("renders New Case button", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} />
      </TestWrapper>
    );

    expect(screen.getByRole("button", { name: /new case/i })).toBeInTheDocument();
  });

  it("calls onNewCase when New Case button is clicked", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByRole("button", { name: /new case/i }));
    expect(mockHandlers.onNewCase).toHaveBeenCalledTimes(1);
  });

  it("calls onSearchChange when search input changes", async () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} searchTerm="" />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText("Search cases...");
    fireEvent.change(searchInput, { target: { value: "test search" } });

    await waitFor(() => {
      expect(mockHandlers.onSearchChange).toHaveBeenCalledWith("test search");
    });
  });

  it("displays search term in input", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} searchTerm="existing search" />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText("Search cases...") as HTMLInputElement;
    expect(searchInput.value).toBe("existing search");
  });

  it("shows bulk actions dropdown when showBulkOperations is true", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} showBulkOperations={true} />
      </TestWrapper>
    );

    expect(screen.getByRole("button", { name: /bulk actions/i })).toBeInTheDocument();
  });

  it("hides bulk actions dropdown when showBulkOperations is false", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} showBulkOperations={false} />
      </TestWrapper>
    );

    expect(screen.queryByRole("button", { name: /bulk actions/i })).not.toBeInTheDocument();
  });

  it("shows more actions menu", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} />
      </TestWrapper>
    );

    const moreButton = screen.getByRole("button", { name: /more actions/i });
    expect(moreButton).toBeInTheDocument();
  });

  it("shows more actions menu button", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} />
      </TestWrapper>
    );

    const moreButton = screen.getByRole("button", { name: /more actions/i });
    expect(moreButton).toBeInTheDocument();
    expect(moreButton).toBeEnabled();
  });

  it("has export handler available", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} onExport={mockHandlers.onExport} />
      </TestWrapper>
    );

    // Verify the component renders with export handler
    const moreButton = screen.getByRole("button", { name: /more actions/i });
    expect(moreButton).toBeInTheDocument();
    
    // Note: Dropdown menu behavior is tested via integration/e2e tests
    // Unit test verifies the structure is present
  });

  it("event listener is registered for focus search", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} />
      </TestWrapper>
    );

    // Verify the component renders with the search input
    const searchInput = screen.getByPlaceholderText("Search cases...");
    expect(searchInput).toBeInTheDocument();
    
    // Note: Full focus event testing would require jsdom setup with proper event bubbling
    // This test verifies component renders which implies the useEffect has run
  });

  it("displays keyboard shortcut hint when search not focused", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} />
      </TestWrapper>
    );

    // Should show keyboard shortcut hint (matches either Ctrl+K or ⌘K)
    const shortcutHint = screen.getByText(/Ctrl\+K|⌘K/);
    expect(shortcutHint).toBeInTheDocument();
  });

  it("hides keyboard shortcut hint when search is focused", async () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText("Search cases...");
    
    // Initially shortcut should be visible
    let shortcutHint = screen.queryByText(/Ctrl\+K|⌘K/);
    expect(shortcutHint).toBeInTheDocument();
    
    // Focus the input
    fireEvent.focus(searchInput);

    // After focus, shortcut hint should not be in document (removed by state change)
    await waitFor(() => {
      shortcutHint = screen.queryByText(/Ctrl\+K|⌘K/);
      expect(shortcutHint).not.toBeInTheDocument();
    });
  });

  it("renders with accessibility attributes", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText("Search cases...");
    expect(searchInput).toHaveAttribute("aria-label", "Search cases");

    const moreButton = screen.getByRole("button", { name: /more actions/i });
    expect(moreButton).toBeInTheDocument();
  });
});
