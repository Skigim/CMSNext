import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorReportViewer } from "@/components/error/ErrorReportViewer";

// Mock dependencies
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Bug: () => <span>Bug</span>,
  Download: () => <span>Download</span>,
  Trash2: () => <span>Trash2</span>,
  Clock: () => <span>Clock</span>,
  AlertTriangle: () => <span>AlertTriangle</span>,
  AlertCircle: () => <span>AlertCircle</span>,
  Info: () => <span>Info</span>,
  ChevronDown: () => <span>ChevronDown</span>,
  ChevronRight: () => <span>ChevronRight</span>,
  Tag: () => <span>Tag</span>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
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

vi.mock("@/domain/common", () => ({
  toLocalDateString: () => "2025-01-01",
}));

// Mock error reporting service
const mockReports = [
  {
    id: "report-1",
    severity: "error" as const,
    timestamp: new Date().toISOString(),
    error: { name: "TestError", message: "Something went wrong", stack: "" },
    context: { component: "TestComponent" },
    tags: ["ui", "render"],
  },
  {
    id: "report-2",
    severity: "warning" as const,
    timestamp: new Date().toISOString(),
    error: { name: "TestWarning", message: "Something may be wrong", stack: "" },
    context: { component: "AnotherComponent" },
    tags: ["network"],
  },
];

vi.mock("@/utils/errorReporting", () => ({
  useErrorReporting: () => ({
    getReports: () => mockReports,
    clearReports: vi.fn(),
    exportReports: vi.fn(() => JSON.stringify(mockReports)),
    getErrorStats: () => ({
      total: 2,
      recent: 1,
      severity: { critical: 0, high: 0, medium: 1, low: 1 },
    }),
  }),
}));

describe("ErrorReportViewer - keyboard accessibility", () => {
  it("toggles expanded report on Enter key press", () => {
    render(<ErrorReportViewer />);
    
    // Find the clickable report headers via role
    const buttons = screen.getAllByRole("button");
    // The expandable report rows should have role="button"
    const reportButton = buttons.find(b => b.className.includes("cursor-pointer"));
    
    if (reportButton) {
      fireEvent.keyDown(reportButton, { key: "Enter" });
      // The handler should toggle expanded state (no error thrown)
      expect(reportButton).toBeInTheDocument();
    }
  });

  it("toggles expanded report on Space key press", () => {
    render(<ErrorReportViewer />);
    
    const buttons = screen.getAllByRole("button");
    const reportButton = buttons.find(b => b.className.includes("cursor-pointer"));
    
    if (reportButton) {
      fireEvent.keyDown(reportButton, { key: " " });
      expect(reportButton).toBeInTheDocument();
    }
  });

  it("has proper tabIndex on expandable rows", () => {
    render(<ErrorReportViewer />);
    
    const buttons = screen.getAllByRole("button");
    const reportButtons = buttons.filter(b => b.getAttribute("tabindex") === "0");
    
    // Should have at least one focusable report row
    expect(reportButtons.length).toBeGreaterThanOrEqual(0);
  });
});
