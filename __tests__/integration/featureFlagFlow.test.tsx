import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ApplicationState from "@/application/ApplicationState";
import { Dashboard } from "@/components/app/Dashboard";
import type { CaseActivityEntry, CaseActivityLogState } from "@/types/activityLog";
import { CASE_STATUS, type CaseDisplay } from "@/types/case";
import type { AlertsIndex, AlertWithMatch } from "@/utils/alertsData";

function createCase(overrides: Partial<CaseDisplay> = {}): CaseDisplay {
  const createdDate = overrides.createdAt ?? "2025-10-01T00:00:00Z";
  return {
    id: overrides.id ?? "case-1",
    name: overrides.name ?? "Sample Case",
    mcn: overrides.mcn ?? "MCN-1",
    status: overrides.status ?? CASE_STATUS.Pending,
    priority: overrides.priority ?? false,
    createdAt: createdDate,
    updatedAt: overrides.updatedAt ?? createdDate,
    person: overrides.person ?? {
      id: "person-1",
      firstName: "Sample",
      lastName: "Person",
      name: "Sample Person",
      email: "sample@example.com",
      phone: "555-0100",
      dateOfBirth: "1990-01-01",
      ssn: "***-**-0000",
      organizationId: null,
      livingArrangement: "Home",
      address: {
        street: "1 Test Way",
        city: "Testville",
        state: "TS",
        zip: "12345",
      },
      mailingAddress: {
        street: "1 Test Way",
        city: "Testville",
        state: "TS",
        zip: "12345",
        sameAsPhysical: true,
      },
      authorizedRepIds: [],
      familyMembers: [],
      status: "Active",
      createdAt: "2025-09-01T00:00:00Z",
      dateAdded: "2025-09-01T00:00:00Z",
    },
    caseRecord: {
      id: overrides.caseRecord?.id ?? overrides.id ?? "case-1",
      mcn: overrides.caseRecord?.mcn ?? overrides.mcn ?? "MCN-1",
      applicationDate: overrides.caseRecord?.applicationDate ?? createdDate,
      caseType: overrides.caseRecord?.caseType ?? "Type",
      personId: overrides.caseRecord?.personId ?? "person-1",
      spouseId: overrides.caseRecord?.spouseId ?? "",
      status: overrides.caseRecord?.status ?? overrides.status ?? "Pending",
      description: overrides.caseRecord?.description ?? "",
      priority: overrides.caseRecord?.priority ?? false,
      livingArrangement: overrides.caseRecord?.livingArrangement ?? "Home",
      withWaiver: overrides.caseRecord?.withWaiver ?? false,
      admissionDate: overrides.caseRecord?.admissionDate ?? createdDate,
      organizationId: overrides.caseRecord?.organizationId ?? "org-1",
      authorizedReps: overrides.caseRecord?.authorizedReps ?? [],
      retroRequested: overrides.caseRecord?.retroRequested ?? "",
      financials: overrides.caseRecord?.financials ?? { resources: [], income: [], expenses: [] },
      notes: overrides.caseRecord?.notes ?? [],
      createdDate: overrides.caseRecord?.createdDate ?? createdDate,
      updatedDate: overrides.caseRecord?.updatedDate ?? createdDate,
    },
    alerts: overrides.alerts,
  } as CaseDisplay;
}

function createAlert(overrides: Partial<AlertWithMatch> = {}): AlertWithMatch {
  return {
    id: overrides.id ?? `alert-${Math.random().toString(36).slice(2, 8)}`,
    reportId: overrides.reportId ?? null,
    alertCode: overrides.alertCode ?? "CODE",
    alertType: overrides.alertType ?? "TYPE",
    alertDate: overrides.alertDate ?? "2025-10-18T00:00:00Z",
    createdAt: overrides.createdAt ?? "2025-10-18T00:00:00Z",
    updatedAt: overrides.updatedAt ?? overrides.createdAt ?? "2025-10-18T00:00:00Z",
    status: overrides.status ?? "resolved",
    resolvedAt: overrides.resolvedAt ?? "2025-10-20T00:00:00Z",
    description: overrides.description ?? "Income mismatch",
    matchStatus: overrides.matchStatus ?? "matched",
    metadata: overrides.metadata ?? {},
  } as AlertWithMatch;
}

function createAlertsIndex(alerts: AlertWithMatch[]): AlertsIndex {
  return {
    alerts,
    summary: {
      total: alerts.length,
      matched: alerts.length,
      unmatched: 0,
      missingMcn: 0,
      latestUpdated: alerts[0]?.updatedAt ?? null,
    },
    alertsByCaseId: new Map(),
    unmatched: [],
    missingMcn: [],
  };
}

function createActivityLogState(entries: CaseActivityEntry[]): CaseActivityLogState {
  return {
    activityLog: entries,
    dailyReports: [],
    todayReport: null,
    yesterdayReport: null,
    loading: false,
    error: null,
    refreshActivityLog: async () => {},
    getReportForDate: () => ({
      date: "2025-10-22",
      totals: { total: entries.length, statusChanges: entries.length, notesAdded: 0 },
      entries,
      cases: [],
    }),
    clearReportForDate: async () => 0,
  };
}

const widgetTitles = [
  "Case Priority",
  "Alerts Cleared/Day",
  "Cases Processed/Day",
  "Activity",
  "Total Cases by Status",
  /Alerts by Description/i, // Use regex for titles that might be split across elements
  "Avg. Alert Age",
  "Avg. Case Processing Time",
];

describe("feature flag integration", () => {
  beforeEach(() => {
    ApplicationState.resetInstance();
  });

  afterEach(() => {
    cleanup();
    ApplicationState.resetInstance();
  });

  function renderDashboard() {
    // Initialize ApplicationState before rendering
    ApplicationState.getInstance();
    
    const cases: CaseDisplay[] = [createCase({ id: "case-1" }), createCase({ id: "case-2", status: CASE_STATUS.Closed })];
    const alerts = [
      createAlert({ id: "alert-1", status: "resolved", resolvedAt: "2025-10-20T00:00:00Z" }),
      createAlert({ id: "alert-2", status: "in-progress", resolvedAt: null }),
    ];
    const activity: CaseActivityEntry[] = [
      {
        id: "act-1",
        type: "status-change",
        timestamp: "2025-10-21T12:00:00Z",
        caseId: "case-1",
        caseName: "Sample Case",
        payload: { toStatus: "Approved", fromStatus: "Pending" },
      },
    ];

    return render(
      <Dashboard
        cases={cases}
        alerts={createAlertsIndex(alerts)}
        activityLogState={createActivityLogState(activity)}
        onViewAllCases={() => {}}
        onNewCase={() => {}}
        onNavigateToReports={() => {}}
      />,
    );
  }

  it("shows all widgets when all flags are enabled", async () => {
    const appState = ApplicationState.getInstance();
    const flags = appState.getFeatureFlags();
    // All flags should be true by default
    expect(flags["dashboard.widgets.casePriority"]).toBe(true);
    expect(flags["dashboard.widgets.alertsCleared"]).toBe(true);
    
    renderDashboard();

    // Wait for each widget using the same pattern as the passing tests
    for (const title of widgetTitles) {
      await waitFor(() => {
        expect(screen.getByText(title)).toBeInTheDocument();
      }, { timeout: 20000 });
    }
  }, 180000); // 3 minute test timeout

  it("hides widgets tied to disabled flags", async () => {
    const appState = ApplicationState.getInstance();
    appState.setFeatureFlags({
      "dashboard.widgets.casePriority": false,
      "dashboard.widgets.avgAlertAge": false,
    });

    renderDashboard();

    for (const title of ["Alerts Cleared/Day", "Activity", "Total Cases by Status"]) {
      await waitFor(() => {
        expect(screen.getByText(title)).toBeInTheDocument();
      });
    }

    expect(screen.queryByText("Case Priority")).toBeNull();
    expect(screen.queryByText("Avg. Alert Age")).toBeNull();
  });

  it("updates widget visibility when flags change at runtime", async () => {
    const appState = ApplicationState.getInstance();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Avg. Alert Age")).toBeInTheDocument();
    });

    act(() => {
      appState.setFeatureFlags({ "dashboard.widgets.avgAlertAge": false });
    });

    await waitFor(() => {
      expect(screen.queryByText("Avg. Alert Age")).toBeNull();
    });

    act(() => {
      appState.setFeatureFlags({ "dashboard.widgets.avgAlertAge": true });
    });

    await waitFor(() => {
      expect(screen.getByText("Avg. Alert Age")).toBeInTheDocument();
    });
  });
});
