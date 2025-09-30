import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CaseAlertsDrawer } from "@/components/case/CaseAlertsDrawer";
import type { AlertWithMatch } from "@/utils/alertsData";

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open, onOpenChange }: any) => (
    <div data-testid="sheet" data-open={open}>
      <button data-testid="sheet-toggle" onClick={() => onOpenChange?.(!open)} />
      {children}
    </div>
  ),
  SheetContent: ({ children }: any) => <div data-testid="sheet-content">{children}</div>,
  SheetHeader: ({ children }: any) => <header>{children}</header>,
  SheetTitle: ({ children }: any) => <h1>{children}</h1>,
  SheetDescription: ({ children }: any) => <p>{children}</p>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => <div data-testid="scroll-area">{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, disabled, onClick, ...rest }: any) => (
    <button disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

const buildAlert = (overrides: Partial<AlertWithMatch> = {}): AlertWithMatch => ({
  id: overrides.id ?? "alert-1",
  reportId: overrides.reportId ?? "alert-1",
  alertCode: overrides.alertCode ?? "CODE",
  alertType: overrides.alertType ?? "Type",
  severity: overrides.severity ?? "High",
  alertDate: overrides.alertDate ?? "2024-03-01T00:00:00.000Z",
  createdAt: overrides.createdAt ?? "2024-03-01T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2024-03-01T00:00:00.000Z",
  mcNumber: overrides.mcNumber ?? "ABC123",
  personName: overrides.personName ?? "Example Person",
  program: overrides.program ?? "Example Program",
  region: overrides.region ?? "Region 1",
  state: overrides.state ?? "NC",
  source: overrides.source ?? "Import",
  description: overrides.description ?? "Follow up with client",
  status: overrides.status ?? "new",
  resolvedAt: overrides.resolvedAt ?? null,
  resolutionNotes: overrides.resolutionNotes,
  metadata: overrides.metadata ?? {},
  matchStatus: overrides.matchStatus ?? "matched",
  matchedCaseId: overrides.matchedCaseId ?? "case-1",
  matchedCaseName: overrides.matchedCaseName ?? "John Doe",
  matchedCaseStatus: overrides.matchedCaseStatus ?? "Active",
});

describe("CaseAlertsDrawer", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
  });

  it("renders open and resolved alerts with actions", async () => {
  const onResolveAlert = vi.fn();

    const openAlert = buildAlert({ id: "open-1", status: "new", severity: "Critical" });
    const resolvedAlert = buildAlert({ id: "resolved-1", status: "resolved", resolvedAt: "2024-04-01T00:00:00.000Z" });

    render(
      <CaseAlertsDrawer
        alerts={[openAlert, resolvedAlert]}
        open
        onOpenChange={() => {}}
        caseName="John Doe"
  onResolveAlert={onResolveAlert}
      />,
    );

    expect(screen.getByText("Open alerts")).toBeInTheDocument();
    expect(screen.getByText("Recently resolved")).toBeInTheDocument();
  expect(screen.getByText("1 open · 1 resolved · 2 total")).toBeInTheDocument();
  expect(screen.getAllByText(/Active alert/i)).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /resolve/i }));
    expect(onResolveAlert).toHaveBeenCalledWith(expect.objectContaining({ id: "open-1" }));

    expect(screen.getByText((content) => content.startsWith("Resolved"))).toBeInTheDocument();
  });

  it("disables actions when handlers are not provided", () => {
    const openAlert = buildAlert({ status: "new" });

    render(
      <CaseAlertsDrawer
        alerts={[openAlert]}
        open
        onOpenChange={() => {}}
        caseName="John Doe"
      />,
    );

    const resolveButton = screen.getByRole("button", { name: /resolve/i });
    expect(resolveButton).toBeDisabled();
  });
});
