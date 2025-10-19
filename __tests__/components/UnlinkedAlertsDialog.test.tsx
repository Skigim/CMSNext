import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnlinkedAlertsDialog } from "@/components/alerts/UnlinkedAlertsDialog";
import type { AlertWithMatch } from "@/utils/alertsData";

function createAlert(overrides: Partial<AlertWithMatch> = {}): AlertWithMatch {
  const timestamp = "2025-09-01T00:00:00.000Z";
  return {
    id: overrides.id ?? `alert-${Math.random().toString(36).slice(2)}`,
    reportId: overrides.reportId ?? "report-1",
  alertCode: overrides.alertCode ?? "AL-1",
  alertType: overrides.alertType ?? "Notice",
    alertDate: overrides.alertDate ?? timestamp,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
    mcNumber: overrides.mcNumber ?? "MCN123",
    personName: overrides.personName ?? "Jamie Rivera",
    program: overrides.program ?? "Medicaid",
    region: overrides.region ?? "Region 1",
    state: overrides.state ?? "FL",
    source: overrides.source ?? "Import",
    description: overrides.description ?? "Follow up with client",
    status: overrides.status ?? "new",
    resolvedAt: overrides.resolvedAt ?? null,
    resolutionNotes: overrides.resolutionNotes,
    metadata: overrides.metadata ?? {},
    matchStatus: overrides.matchStatus ?? "unmatched",
    matchedCaseId: overrides.matchedCaseId,
    matchedCaseName: overrides.matchedCaseName,
    matchedCaseStatus: overrides.matchedCaseStatus,
  } satisfies AlertWithMatch;
}

describe("UnlinkedAlertsDialog", () => {
  it("shows a fallback message when no alerts are provided", () => {
    render(
      <UnlinkedAlertsDialog alerts={[]} open onOpenChange={() => {}} />,
    );

    expect(screen.getByText(/all open alerts are linked to cases/i)).toBeInTheDocument();
  });

  it("renders alert details when alerts exist", () => {
    const alerts = [
      createAlert({
        id: "unlinked-1",
        description: "Missing verification",
        matchStatus: "unmatched",
      }),
      createAlert({
        id: "unlinked-2",
        description: "MCN missing",
        matchStatus: "missing-mcn",
      }),
    ];

    render(
      <UnlinkedAlertsDialog alerts={alerts} open onOpenChange={() => {}} />,
    );

    expect(screen.getByText(/missing verification/i)).toBeInTheDocument();
    expect(screen.getByText(/missing mcn/i)).toBeInTheDocument();
    expect(screen.getByText(/needs review/i)).toBeInTheDocument();
  });
});
