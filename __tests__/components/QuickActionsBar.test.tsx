import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
function TestWrapper({ children }: { readonly children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

// Mock case and alert data for testing
const mockCases = [
  {
    id: "case-1",
    name: "John Doe",
    mcn: "MCN001",
    status: "Pending",
    priority: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    person: { 
      firstName: "John", 
      lastName: "Doe",
      middleName: "",
      ssn: "",
      dateOfBirth: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      zip: "",
    },
    caseRecord: { 
      id: "case-1",
      mcn: "MCN001",
      status: "Pending",
      priority: false,
      caseType: "Type A",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      createdDate: "2026-01-01",
      updatedDate: "2026-01-01",
      admissionDate: "",
      livingArrangement: "",
      description: "",
      retroRequested: false,
      retroFrom: "",
      retroTo: "",
      voterFormStatus: "" as const,
    },
  },
] as unknown as import("@/types/case").StoredCase[];

const mockAlerts: never[] = [];

describe("QuickActionsBar", () => {
  const mockHandlers = {
    onNewCase: vi.fn(),
    onViewCase: vi.fn(),
    cases: mockCases,
    alerts: mockAlerts,
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

    expect(screen.getByPlaceholderText("Search cases and alerts...")).toBeInTheDocument();
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

  it("displays keyboard shortcut hint", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} />
      </TestWrapper>
    );

    // Should show keyboard shortcut hint (matches either Ctrl+K or ⌘K)
    const shortcutHint = screen.getByText(/Ctrl\+K|⌘K/);
    expect(shortcutHint).toBeInTheDocument();
  });

  it("renders with accessibility attributes", () => {
    render(
      <TestWrapper>
        <QuickActionsBar {...mockHandlers} />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText("Search cases and alerts...");
    expect(searchInput).toHaveAttribute("aria-label", "Search cases and alerts");

    const moreButton = screen.getByRole("button", { name: /more actions/i });
    expect(moreButton).toBeInTheDocument();
  });
});
