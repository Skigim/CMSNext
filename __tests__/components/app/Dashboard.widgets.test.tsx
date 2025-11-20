import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dashboard } from "@/components/app/Dashboard";
import { AvgAlertAgeWidget } from "@/components/app/widgets/AvgAlertAgeWidget";
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
  resolvedAt: overrides.resolvedAt !== undefined ? overrides.resolvedAt : "2025-10-20T00:00:00Z",
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
    refreshActivityLog: async () => { },
    getReportForDate: () => ({
      date: "2025-10-22",
      totals: { total: entries.length, statusChanges: entries.length, notesAdded: 0 },
      entries,
      cases: [],
    }),
    clearReportForDate: async () => 0,
  };
}

describe("Dashboard widgets integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders all eight widgets", async () => {
    const user = userEvent.setup();
    
    const cases: CaseDisplay[] = [
      createCase({ id: "case-1", status: CASE_STATUS.Pending }),
      createCase({ id: "case-2", status: CASE_STATUS.Closed }),
    ];

    const alerts = [
      createAlert({ id: "alert-1", status: "resolved", resolvedAt: "2025-10-20T00:00:00Z", description: "Income mismatch" }),
      createAlert({ id: "alert-2", status: "in-progress", resolvedAt: null, description: "Missing assets" }),
      createAlert({ id: "alert-3", status: "resolved", resolvedAt: "2025-10-19T00:00:00Z", description: "Income mismatch" }),
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
      {
        id: "act-2",
        type: "note-added",
        timestamp: "2025-10-20T15:00:00Z",
        caseId: "case-2",
        caseName: "Another Case",
        payload: { noteId: "n1", category: "General", preview: "Added a note" },
      },
    ];

    render(
      <Dashboard
        cases={cases}
        alerts={createAlertsIndex(alerts)}
        activityLogState={createActivityLogState(activity)}
        onViewAllCases={() => { }}
        onNewCase={() => { }}
        onNavigateToReports={() => { }}
      />,
    );

    // Wait for Overview widgets to load
    await screen.findByText("Activity", undefined, { timeout: 10000 });

    // Switch to Analytics tab
    const analyticsTab = screen.getByRole("tab", { name: /analytics/i });
    await user.click(analyticsTab);

    // Wait for Analytics widgets to load
    await screen.findByText("Case Priority", undefined, { timeout: 10000 });
    await screen.findByText("Alerts Cleared/Day", undefined, { timeout: 10000 });
    await screen.findByText("Cases Processed/Day", undefined, { timeout: 10000 });
    await screen.findByText("Total Cases by Status", undefined, { timeout: 10000 });
    // Check with regex since the title might be split across elements
    await screen.findByText(/Alerts by Description/i, undefined, { timeout: 10000 });
    await screen.findByText("Avg. Alert Age", undefined, { timeout: 10000 });
    await screen.findByText("Avg. Case Processing Time", undefined, { timeout: 10000 });
  }, 30000); // 30 second timeout for this test

  it("updates widget data when underlying props change", async () => {
    const user = userEvent.setup();
    
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2025-10-22T00:00:00Z"));

    const cases: CaseDisplay[] = [
      createCase({ id: "case-1", status: CASE_STATUS.Pending }),
      createCase({ id: "case-2", status: CASE_STATUS.Active }),
    ];

    const initialAlerts = [
      createAlert({ id: "alert-1", status: "in-progress", resolvedAt: null, alertDate: "2025-10-15T00:00:00Z" }),
      createAlert({ id: "alert-2", status: "acknowledged", resolvedAt: null, alertDate: "2025-09-20T00:00:00Z" }),
    ];

    const updatedAlerts = [
      createAlert({ id: "alert-1", status: "in-progress", resolvedAt: null, alertDate: "2025-10-19T00:00:00Z" }),
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

    const activityLogState = createActivityLogState(activity);

    const initialRender = render(
      <Dashboard
        cases={cases}
        alerts={createAlertsIndex(initialAlerts)}
        activityLogState={activityLogState}
        onViewAllCases={() => { }}
        onNewCase={() => { }}
        onNavigateToReports={() => { }}
      />,
    );

    // Wait for all widgets to load (Suspense boundaries to resolve)
    await act(async () => {
      await Promise.resolve();
    });

    // Switch to Analytics tab to see Avg. Alert Age
    const analyticsTab = screen.getByRole("tab", { name: /analytics/i });
    await user.click(analyticsTab);

    // Use within to scope to this specific render
    const avgAlertHeading = await within(initialRender.container).findByText("Avg. Alert Age");
    let avgAlertCard = avgAlertHeading.closest('[data-slot="card"]');
    expect(avgAlertCard).not.toBeNull();

    const initialCard = avgAlertCard as HTMLElement;
    await within(initialCard).findByText("2 open");

    initialRender.unmount();

    render(
      <Dashboard
        cases={cases}
        alerts={createAlertsIndex(updatedAlerts)}
        activityLogState={activityLogState}
        onViewAllCases={() => { }}
        onNewCase={() => { }}
        onNavigateToReports={() => { }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Switch to Analytics tab again
    const analyticsTab2 = screen.getByRole("tab", { name: /analytics/i });
    await user.click(analyticsTab2);

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    avgAlertCard = screen.getByText("Avg. Alert Age").closest('[data-slot="card"]');
    expect(avgAlertCard).not.toBeNull();

    const refreshedCard = avgAlertCard as HTMLElement;

    await within(refreshedCard).findByText("1 open");
  }, 30000); // 30 second timeout for this test
});

describe("AvgAlertAgeWidget", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("refreshes metrics when alerts props change", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2025-10-22T00:00:00Z"));

    const initialAlerts = [
      createAlert({ id: "alert-1", status: "in-progress", resolvedAt: null, alertDate: "2025-10-15T00:00:00Z" }),
      createAlert({ id: "alert-2", status: "acknowledged", resolvedAt: null, alertDate: "2025-09-20T00:00:00Z" }),
    ];

    const initialRender = render(
      <AvgAlertAgeWidget alerts={initialAlerts} metadata={{ id: "avg-alert-age", title: "Avg. Alert Age" }} />,
    );

    await screen.findByText("2 open");

    const updatedAlerts = [
      createAlert({ id: "alert-1", status: "in-progress", resolvedAt: null, alertDate: "2025-10-19T00:00:00Z" }),
    ];

    initialRender.unmount();

    render(
      <AvgAlertAgeWidget alerts={updatedAlerts} metadata={{ id: "avg-alert-age", title: "Avg. Alert Age" }} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    await waitFor(() => {
      expect(screen.getByText("1 open")).toBeInTheDocument();
    });
  });
});
