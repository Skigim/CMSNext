import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AlertBadge } from "@/components/alerts/AlertBadge";
import type { AlertWithMatch } from "@/utils/alertsData";
import { getAlertDisplayDescription, getAlertDueDateInfo } from "@/utils/alertDisplay";

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: any) => <div data-testid="tooltip-provider">{children}</div>,
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
  TooltipTrigger: ({ children }: any) => <div data-testid="tooltip-trigger">{children}</div>,
  TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
}));

const buildAlert = (overrides: Partial<AlertWithMatch> = {}): AlertWithMatch => {
  const timestamp = "2024-01-01T00:00:00.000Z";
  return {
    id: overrides.id ?? `alert-${Math.random().toString(36).slice(2)}`,
    reportId: overrides.reportId ?? "report-1",
    alertCode: overrides.alertCode ?? "AL-1",
    alertType: overrides.alertType ?? "Notice",
    severity: overrides.severity ?? "High",
    alertDate: overrides.alertDate ?? timestamp,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
    mcNumber: overrides.mcNumber ?? "MCN123",
    personName: overrides.personName ?? "Jamie Rivera",
    program: overrides.program ?? "Medicaid",
    region: overrides.region ?? "Region 1",
    state: overrides.state ?? "FL",
    source: overrides.source ?? "Import",
    description: overrides.description ?? "Mail Received",
    status: overrides.status ?? "new",
    resolvedAt: overrides.resolvedAt ?? null,
    resolutionNotes: overrides.resolutionNotes,
    metadata: overrides.metadata ?? {},
    matchStatus: overrides.matchStatus ?? "matched",
    matchedCaseId: overrides.matchedCaseId ?? "case-1",
    matchedCaseName: overrides.matchedCaseName ?? "Jamie Rivera",
    matchedCaseStatus: overrides.matchedCaseStatus ?? "Pending",
  } satisfies AlertWithMatch;
};

describe("AlertBadge", () => {
  it("lists individual alerts with description and due date details", () => {
    const alerts = [
      buildAlert({ id: "alert-1", description: "Mail Received" }),
      buildAlert({ id: "alert-2", description: "Mail Received" }),
      buildAlert({ id: "alert-3", description: "Follow-up Call" }),
    ];

    render(<AlertBadge alerts={alerts} />);

    expect(screen.getByText("3")).toBeInTheDocument();

    const firstDescription = getAlertDisplayDescription(alerts[0]);
    const firstDue = getAlertDueDateInfo(alerts[0]);
    const firstDueLabel = firstDue.hasDate ? `Due ${firstDue.label}` : firstDue.label;

  expect(screen.getAllByText(firstDescription).length).toBeGreaterThanOrEqual(2);
  expect(screen.getAllByText(firstDueLabel).length).toBeGreaterThanOrEqual(2);

    const thirdDescription = getAlertDisplayDescription(alerts[2]);
    const thirdDue = getAlertDueDateInfo(alerts[2]);
    const thirdDueLabel = thirdDue.hasDate ? `Due ${thirdDue.label}` : thirdDue.label;

  expect(screen.getByText(thirdDescription)).toBeInTheDocument();
  expect(screen.getAllByText(thirdDueLabel).length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to a default description when one is missing", () => {
    const alerts = [
      buildAlert({ id: "alert-1", description: "" }),
      buildAlert({ id: "alert-2", description: "  " }),
    ];

    render(<AlertBadge alerts={alerts} />);

    const fallbackDescription = getAlertDisplayDescription(alerts[0]);
    expect(screen.getAllByText(fallbackDescription).length).toBeGreaterThanOrEqual(2);

    const due = getAlertDueDateInfo(alerts[0]);
    const dueLabel = due.hasDate ? `Due ${due.label}` : due.label;
    expect(screen.getAllByText(dueLabel).length).toBeGreaterThanOrEqual(2);
  });

  it("filters resolved alerts out of the badge count", () => {
    const alerts = [
      buildAlert({ id: "open-1", description: "Follow up", status: "new", resolvedAt: null }),
      buildAlert({ id: "resolved-1", description: "Completed", status: "resolved", resolvedAt: "2025-09-30T00:00:00.000Z" }),
    ];

    render(<AlertBadge alerts={alerts} />);

    expect(screen.getByLabelText("1 alert")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });
});
