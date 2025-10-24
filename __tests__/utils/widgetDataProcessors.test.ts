import { describe, expect, it } from "vitest";

import type { AlertWithMatch } from "@/utils/alertsData";
import type { CaseActivityEntry } from "@/types/activityLog";
import type { CaseDisplay } from "@/types/case";
import {
  calculateAlertsClearedPerDay,
  calculateCasesProcessedPerDay,
  calculateTotalCasesByStatus,
  calculateTotalAlertsByDescription,
  calculateAvgAlertAge,
  calculateAvgCaseProcessingTime,
  widgetDateUtils,
} from "@/utils/widgetDataProcessors";

const referenceDate = widgetDateUtils.startOfDay(new Date("2025-10-22T00:00:00Z"));

function buildAlert(partial: Partial<AlertWithMatch>): AlertWithMatch {
  return {
    id: partial.id ?? "alert-1",
    reportId: partial.reportId ?? null,
    alertCode: partial.alertCode ?? "CODE",
    alertType: partial.alertType ?? "TYPE",
    alertDate: partial.alertDate ?? "2025-10-20T00:00:00Z",
    createdAt: partial.createdAt ?? "2025-10-18T00:00:00Z",
    updatedAt: partial.updatedAt ?? partial.createdAt ?? "2025-10-18T00:00:00Z",
    status: partial.status ?? "resolved",
    description: partial.description ?? "Generic",
  resolvedAt: partial.resolvedAt !== undefined ? partial.resolvedAt : "2025-10-21T00:00:00Z",
    metadata: partial.metadata ?? {},
    matchStatus: partial.matchStatus ?? "matched",
  } as AlertWithMatch;
}

function buildCase(partial: Partial<CaseDisplay>): CaseDisplay {
  const caseOverrides: Partial<CaseDisplay["caseRecord"]> = partial.caseRecord ?? {};
  const createdDate = caseOverrides.createdDate ?? partial.createdAt ?? "2025-10-01T00:00:00Z";

  const person = partial.person ?? {
    id: "person-1",
    firstName: "Test",
    lastName: "User",
    name: "Test User",
    email: "test@example.com",
    phone: "555-0000",
    dateOfBirth: "1990-01-01",
    ssn: "***-**-1111",
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
  };

  const caseRecord = {
    id: caseOverrides.id ?? partial.id ?? "case-1",
    mcn: caseOverrides.mcn ?? partial.mcn ?? "MCN-1",
    applicationDate: caseOverrides.applicationDate ?? createdDate,
    caseType: caseOverrides.caseType ?? "Type",
    personId: caseOverrides.personId ?? person.id,
    spouseId: caseOverrides.spouseId ?? "",
    status: caseOverrides.status ?? partial.status ?? "Pending",
    description: caseOverrides.description ?? "",
    priority: caseOverrides.priority ?? false,
    livingArrangement: caseOverrides.livingArrangement ?? "Home",
    withWaiver: caseOverrides.withWaiver ?? false,
    admissionDate: caseOverrides.admissionDate ?? createdDate,
    organizationId: caseOverrides.organizationId ?? "org-1",
    authorizedReps: caseOverrides.authorizedReps ?? [],
    retroRequested: caseOverrides.retroRequested ?? "",
    financials: caseOverrides.financials ?? {
      resources: [],
      income: [],
      expenses: [],
    },
    notes: caseOverrides.notes ?? [],
    createdDate,
    updatedDate: caseOverrides.updatedDate ?? createdDate,
  } as CaseDisplay["caseRecord"];

  return {
    id: partial.id ?? "case-1",
    name: partial.name ?? "Test Case",
    mcn: partial.mcn ?? "MCN-1",
    status: partial.status ?? caseRecord.status,
    priority: partial.priority ?? false,
    createdAt: partial.createdAt ?? createdDate,
    updatedAt: partial.updatedAt ?? createdDate,
    person,
    caseRecord,
    alerts: partial.alerts,
  } as CaseDisplay;
}

describe("widgetDataProcessors", () => {
  describe("calculateAlertsClearedPerDay", () => {
    it("counts resolved alerts across the last seven days", () => {
      const alerts: AlertWithMatch[] = [
        buildAlert({ id: "a1", resolvedAt: "2025-10-22T10:00:00Z", status: "resolved" }),
        buildAlert({ id: "a2", resolvedAt: "2025-10-20T08:00:00Z", status: "resolved" }),
        buildAlert({ id: "a3", resolvedAt: "2025-10-18T12:00:00Z", status: "resolved" }),
        buildAlert({ id: "a4", resolvedAt: "2025-10-05T12:00:00Z", status: "resolved" }), // outside window
        buildAlert({ id: "a5", resolvedAt: null, status: "in-progress" }),
      ];

      const stats = calculateAlertsClearedPerDay(alerts, { referenceDate });

      expect(stats).toHaveLength(7);
      const counts = stats.map((entry) => entry.clearedCount);
      expect(counts.reduce((sum, value) => sum + value, 0)).toBe(3);
      const latestDay = stats[stats.length - 1];
      expect(latestDay.date).toBe("2025-10-22");
      expect(latestDay.clearedCount).toBe(1);
    });

    it("handles empty input", () => {
      const stats = calculateAlertsClearedPerDay([], { referenceDate });
      expect(stats).toHaveLength(7);
      expect(stats.every((entry) => entry.clearedCount === 0)).toBe(true);
    });
  });

  describe("calculateCasesProcessedPerDay", () => {
    it("groups completed status changes", () => {
      const activity: CaseActivityEntry[] = [
        {
          id: "c1",
          type: "status-change",
          timestamp: "2025-10-21T14:00:00Z",
          caseId: "case-1",
          caseName: "Case 1",
          payload: { toStatus: "Approved" },
        },
        {
          id: "c2",
          type: "status-change",
          timestamp: "2025-10-20T09:00:00Z",
          caseId: "case-2",
          caseName: "Case 2",
          payload: { toStatus: "Closed" },
        },
        {
          id: "c3",
          type: "status-change",
          timestamp: "2025-10-15T10:00:00Z",
          caseId: "case-3",
          caseName: "Case 3",
          payload: { toStatus: "Pending" },
        },
        {
          id: "c4",
          type: "note-added",
          timestamp: "2025-10-22T11:00:00Z",
          caseId: "case-4",
          caseName: "Case 4",
          payload: { noteId: "n1", category: "General", preview: "note" },
        },
      ];

      const stats = calculateCasesProcessedPerDay(activity, { referenceDate });
      expect(stats).toHaveLength(7);
      expect(stats.map((entry) => entry.processedCount).reduce((sum, value) => sum + value, 0)).toBe(2);
      const day = stats[stats.length - 2];
      expect(day.date).toBe("2025-10-21");
      expect(day.processedCount).toBe(1);
    });
  });

  describe("calculateTotalCasesByStatus", () => {
    it("produces counts and percentages per status", () => {
      const cases: CaseDisplay[] = [
        buildCase({ id: "case-1", status: "Pending" }),
        buildCase({ id: "case-2", status: "Pending" }),
        buildCase({ id: "case-3", status: "Closed" }),
      ];

      const breakdown = calculateTotalCasesByStatus(cases);
      expect(breakdown).toHaveLength(2);
      expect(breakdown[0].status).toBe("Pending");
      expect(breakdown[0].count).toBe(2);
      expect(breakdown[0].percentage).toBeCloseTo(66.6, 0);
    });
  });

  describe("calculateTotalAlertsByDescription", () => {
    it("aggregates counts by description and flags open vs resolved", () => {
      const alerts: AlertWithMatch[] = [
        buildAlert({ id: "al-1", description: "Income mismatch", status: "resolved", resolvedAt: "2025-10-20T00:00:00Z" }),
        buildAlert({ id: "al-2", description: "Income mismatch", status: "in-progress", resolvedAt: null }),
        buildAlert({ id: "al-3", description: "Missing assets", status: "resolved", resolvedAt: "2025-10-19T00:00:00Z" }),
      ];

      const breakdown = calculateTotalAlertsByDescription(alerts);
      expect(breakdown).toHaveLength(2);
      const top = breakdown[0];
      expect(top.description).toBe("Income mismatch");
      expect(top.count).toBe(2);
      expect(top.openCount).toBe(1);
      expect(top.resolvedCount).toBe(1);
      expect(top.percentage).toBeCloseTo(66.6, 0);
    });
  });

  describe("calculateAvgAlertAge", () => {
    it("computes average, median, and backlog metrics", () => {
      const alerts: AlertWithMatch[] = [
        buildAlert({ id: "backlog-1", status: "new", resolvedAt: null, alertDate: "2025-10-15T00:00:00Z" }),
        buildAlert({ id: "backlog-2", status: "acknowledged", resolvedAt: null, alertDate: "2025-09-01T00:00:00Z" }),
        buildAlert({ id: "backlog-3", status: "resolved", resolvedAt: "2025-10-18T00:00:00Z" }),
      ];

      const stats = calculateAvgAlertAge(alerts, { referenceDate });
      expect(stats.openCount).toBe(2);
      expect(stats.averageDays).toBeCloseTo(29, 0);
      expect(stats.medianDays).toBeCloseTo(29, 0);
      expect(stats.oldestDays).toBe(51);
      expect(stats.over30Days).toBe(1);
    });
  });

  describe("calculateAvgCaseProcessingTime", () => {
    it("summarizes processing durations and previous baseline", () => {
      const case1 = buildCase({ id: "case-1", status: "Approved" });
      case1.caseRecord.createdDate = "2025-10-01T00:00:00Z";
      const case2 = buildCase({ id: "case-2", status: "Denied" });
      case2.caseRecord.createdDate = "2025-10-05T00:00:00Z";
      const case3 = buildCase({ id: "case-3", status: "Closed" });
      case3.caseRecord.createdDate = "2025-08-20T00:00:00Z";

      const cases: CaseDisplay[] = [case1, case2, case3];

      const activity: CaseActivityEntry[] = [
        {
          id: "act-1",
          type: "status-change",
          timestamp: "2025-10-10T12:00:00Z",
          caseId: "case-1",
          caseName: "Case 1",
          payload: { toStatus: "Approved", fromStatus: "Pending" },
        },
        {
          id: "act-2",
          type: "status-change",
          timestamp: "2025-10-18T09:00:00Z",
          caseId: "case-2",
          caseName: "Case 2",
          payload: { toStatus: "Denied", fromStatus: "Pending" },
        },
        {
          id: "act-3",
          type: "status-change",
          timestamp: "2025-09-05T09:00:00Z",
          caseId: "case-3",
          caseName: "Case 3",
          payload: { toStatus: "Closed", fromStatus: "Pending" },
        },
      ];

      const stats = calculateAvgCaseProcessingTime(activity, cases, {
        referenceDate,
        windowInDays: 30,
      });

      expect(stats.sampleSize).toBe(2);
      expect(stats.averageDays).toBeCloseTo(11, 1);
      expect(stats.medianDays).toBeCloseTo(11, 1);
      expect(stats.byStatus.Approved).toBeCloseTo(9, 1);
      expect(stats.byStatus.Denied).toBeCloseTo(13, 1);
      expect(stats.previousAverageDays).toBeCloseTo(16, 1);
    });
  });
});
