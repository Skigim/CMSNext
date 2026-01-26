import { describe, expect, it } from "vitest";

import type { AlertWithMatch } from "@/utils/alertsData";
import type { CaseActivityEntry } from "@/types/activityLog";
import { CASE_STATUS, type CaseDisplay } from "@/types/case";
import {
  calculateAlertsClearedPerDay,
  calculateCasesProcessedPerDay,
  calculateTotalCasesByStatus,
  calculateTotalAlertsByDescription,
  calculateAvgAlertAge,
  calculateAvgCaseProcessingTime,
  widgetDateUtils,
} from "../widgets";

function isoLocal(year: number, monthIndex: number, day: number, hours = 0, minutes = 0, seconds = 0) {
  return new Date(year, monthIndex, day, hours, minutes, seconds).toISOString();
}

const referenceDate = widgetDateUtils.startOfDay(new Date(2025, 9, 22));

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
    status: caseOverrides.status ?? partial.status ?? CASE_STATUS.Pending,
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
      // Use local time construction to avoid timezone issues
  const day22 = isoLocal(2025, 9, 22, 10, 0, 0);
  const day20 = isoLocal(2025, 9, 20, 8, 0, 0);
  const day18 = isoLocal(2025, 9, 18, 12, 0, 0);
  const day05 = isoLocal(2025, 9, 5, 12, 0, 0);
      
      const alerts: AlertWithMatch[] = [
        buildAlert({ id: "a1", resolvedAt: day22, status: "resolved" }),
        buildAlert({ id: "a2", resolvedAt: day20, status: "resolved" }),
        buildAlert({ id: "a3", resolvedAt: day18, status: "resolved" }),
        buildAlert({ id: "a4", resolvedAt: day05, status: "resolved" }), // outside window
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
      // Use local time construction
  const day21 = isoLocal(2025, 9, 21, 14, 0, 0);
  const day20 = isoLocal(2025, 9, 20, 9, 0, 0);
  const day15 = isoLocal(2025, 9, 15, 10, 0, 0);
  const day22 = isoLocal(2025, 9, 22, 11, 0, 0);
      
      const activity: CaseActivityEntry[] = [
        {
          id: "c1",
          type: "status-change",
          timestamp: day21,
          caseId: "case-1",
          caseName: "Case 1",
          payload: { toStatus: "Approved" },
        },
        {
          id: "c2",
          type: "status-change",
          timestamp: day20,
          caseId: "case-2",
          caseName: "Case 2",
          payload: { toStatus: "Closed" },
        },
        {
          id: "c3",
          type: "status-change",
          timestamp: day15,
          caseId: "case-3",
          caseName: "Case 3",
          payload: { toStatus: "Pending" },
        },
        {
          id: "c4",
          type: "note-added",
          timestamp: day22,
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

    it("decrements count when reverting from a completion status", () => {
      const day21 = isoLocal(2025, 9, 21, 14, 0, 0);
      const day21Later = isoLocal(2025, 9, 21, 16, 0, 0);

      const activity: CaseActivityEntry[] = [
        {
          id: "c1",
          type: "status-change",
          timestamp: day21,
          caseId: "case-1",
          caseName: "Case 1",
          payload: { fromStatus: "Pending", toStatus: "Approved" },
        },
        {
          id: "c2",
          type: "status-change",
          timestamp: day21Later,
          caseId: "case-1",
          caseName: "Case 1",
          payload: { fromStatus: "Approved", toStatus: "Pending" },
        },
      ];

      const stats = calculateCasesProcessedPerDay(activity, { referenceDate });
      const day = stats.find((s) => s.date === "2025-10-21");
      expect(day?.processedCount).toBe(0); // +1 then -1 = net 0
    });

    it("does not change count when moving between completion statuses", () => {
      const day21 = isoLocal(2025, 9, 21, 14, 0, 0);

      const activity: CaseActivityEntry[] = [
        {
          id: "c1",
          type: "status-change",
          timestamp: day21,
          caseId: "case-1",
          caseName: "Case 1",
          payload: { fromStatus: "Approved", toStatus: "Denied" },
        },
      ];

      const stats = calculateCasesProcessedPerDay(activity, { referenceDate });
      const day = stats.find((s) => s.date === "2025-10-21");
      expect(day?.processedCount).toBe(0); // Moving between completions = no net change
    });

    describe("requireNoteOnSameDay option", () => {
      it("counts status changes without notes when disabled (default)", () => {
        const day21 = isoLocal(2025, 9, 21, 14, 0, 0);

        const activity: CaseActivityEntry[] = [
          {
            id: "c1",
            type: "status-change",
            timestamp: day21,
            caseId: "case-1",
            caseName: "Case 1",
            payload: { fromStatus: "Pending", toStatus: "Approved" },
          },
        ];

        const stats = calculateCasesProcessedPerDay(activity, { 
          referenceDate,
          requireNoteOnSameDay: false,
        });
        const day = stats.find((s) => s.date === "2025-10-21");
        expect(day?.processedCount).toBe(1);
      });

      it("excludes status changes without notes when enabled", () => {
        const day21 = isoLocal(2025, 9, 21, 14, 0, 0);

        const activity: CaseActivityEntry[] = [
          {
            id: "c1",
            type: "status-change",
            timestamp: day21,
            caseId: "case-1",
            caseName: "Case 1",
            payload: { fromStatus: "Pending", toStatus: "Approved" },
          },
        ];

        const stats = calculateCasesProcessedPerDay(activity, { 
          referenceDate,
          requireNoteOnSameDay: true,
        });
        const day = stats.find((s) => s.date === "2025-10-21");
        expect(day?.processedCount).toBe(0); // No note added = not counted
      });

      it("counts status changes with notes on the same day when enabled", () => {
        const day21Morning = isoLocal(2025, 9, 21, 9, 0, 0);
        const day21Afternoon = isoLocal(2025, 9, 21, 14, 0, 0);

        const activity: CaseActivityEntry[] = [
          {
            id: "n1",
            type: "note-added",
            timestamp: day21Morning,
            caseId: "case-1",
            caseName: "Case 1",
            payload: { noteId: "note-1", category: "General", preview: "Reviewed documentation" },
          },
          {
            id: "c1",
            type: "status-change",
            timestamp: day21Afternoon,
            caseId: "case-1",
            caseName: "Case 1",
            payload: { fromStatus: "Pending", toStatus: "Approved" },
          },
        ];

        const stats = calculateCasesProcessedPerDay(activity, { 
          referenceDate,
          requireNoteOnSameDay: true,
        });
        const day = stats.find((s) => s.date === "2025-10-21");
        expect(day?.processedCount).toBe(1); // Note added = counted
      });

      it("does not count if note is on a different day than status change", () => {
        const day20 = isoLocal(2025, 9, 20, 14, 0, 0);
        const day21 = isoLocal(2025, 9, 21, 14, 0, 0);

        const activity: CaseActivityEntry[] = [
          {
            id: "n1",
            type: "note-added",
            timestamp: day20,
            caseId: "case-1",
            caseName: "Case 1",
            payload: { noteId: "note-1", category: "General", preview: "Reviewed documentation" },
          },
          {
            id: "c1",
            type: "status-change",
            timestamp: day21,
            caseId: "case-1",
            caseName: "Case 1",
            payload: { fromStatus: "Pending", toStatus: "Approved" },
          },
        ];

        const stats = calculateCasesProcessedPerDay(activity, { 
          referenceDate,
          requireNoteOnSameDay: true,
        });
        const day21Stats = stats.find((s) => s.date === "2025-10-21");
        expect(day21Stats?.processedCount).toBe(0); // Note on different day = not counted
      });

      it("handles multiple cases with mixed note presence", () => {
        const day21Morning = isoLocal(2025, 9, 21, 9, 0, 0);
        const day21Afternoon = isoLocal(2025, 9, 21, 14, 0, 0);
        const day21Evening = isoLocal(2025, 9, 21, 17, 0, 0);

        const activity: CaseActivityEntry[] = [
          // Case 1: has note
          {
            id: "n1",
            type: "note-added",
            timestamp: day21Morning,
            caseId: "case-1",
            caseName: "Case 1",
            payload: { noteId: "note-1", category: "General", preview: "Worked on case" },
          },
          {
            id: "c1",
            type: "status-change",
            timestamp: day21Afternoon,
            caseId: "case-1",
            caseName: "Case 1",
            payload: { fromStatus: "Pending", toStatus: "Approved" },
          },
          // Case 2: no note (cleanup)
          {
            id: "c2",
            type: "status-change",
            timestamp: day21Afternoon,
            caseId: "case-2",
            caseName: "Case 2",
            payload: { fromStatus: "Pending", toStatus: "Closed" },
          },
          // Case 3: has note
          {
            id: "n3",
            type: "note-added",
            timestamp: day21Afternoon,
            caseId: "case-3",
            caseName: "Case 3",
            payload: { noteId: "note-3", category: "General", preview: "Final review" },
          },
          {
            id: "c3",
            type: "status-change",
            timestamp: day21Evening,
            caseId: "case-3",
            caseName: "Case 3",
            payload: { fromStatus: "Pending", toStatus: "Denied" },
          },
        ];

        const stats = calculateCasesProcessedPerDay(activity, { 
          referenceDate,
          requireNoteOnSameDay: true,
        });
        const day = stats.find((s) => s.date === "2025-10-21");
        expect(day?.processedCount).toBe(2); // Only cases 1 and 3 have notes
      });

      it("still applies reversion logic when requireNoteOnSameDay is enabled", () => {
        const day21Morning = isoLocal(2025, 9, 21, 9, 0, 0);
        const day21Afternoon = isoLocal(2025, 9, 21, 14, 0, 0);
        const day21Evening = isoLocal(2025, 9, 21, 17, 0, 0);

        const activity: CaseActivityEntry[] = [
          // Note added
          {
            id: "n1",
            type: "note-added",
            timestamp: day21Morning,
            caseId: "case-1",
            caseName: "Case 1",
            payload: { noteId: "note-1", category: "General", preview: "Working on it" },
          },
          // Approved
          {
            id: "c1",
            type: "status-change",
            timestamp: day21Afternoon,
            caseId: "case-1",
            caseName: "Case 1",
            payload: { fromStatus: "Pending", toStatus: "Approved" },
          },
          // Reverted
          {
            id: "c2",
            type: "status-change",
            timestamp: day21Evening,
            caseId: "case-1",
            caseName: "Case 1",
            payload: { fromStatus: "Approved", toStatus: "Pending" },
          },
        ];

        const stats = calculateCasesProcessedPerDay(activity, { 
          referenceDate,
          requireNoteOnSameDay: true,
        });
        const day = stats.find((s) => s.date === "2025-10-21");
        expect(day?.processedCount).toBe(0); // +1 then -1 = net 0 (both have notes)
      });
    });
  });

  describe("calculateTotalCasesByStatus", () => {
    it("produces counts and percentages per status", () => {
      const cases: CaseDisplay[] = [
        buildCase({ id: "case-1", status: CASE_STATUS.Pending }),
        buildCase({ id: "case-2", status: CASE_STATUS.Pending }),
        buildCase({ id: "case-3", status: CASE_STATUS.Closed }),
      ];

      const breakdown = calculateTotalCasesByStatus(cases);
      expect(breakdown).toHaveLength(2);
      expect(breakdown[0].status).toBe("Pending");
      expect(breakdown[0].count).toBe(2);
      expect(breakdown[0].percentage).toBeCloseTo(66.6, 0);
    });
  });

  describe("calculateTotalAlertsByDescription", () => {
    it("aggregates counts by description showing only open alerts", () => {
      const alerts: AlertWithMatch[] = [
        buildAlert({ id: "al-1", description: "Income mismatch", status: "resolved", resolvedAt: "2025-10-20T00:00:00Z" }),
        buildAlert({ id: "al-2", description: "Income mismatch", status: "in-progress", resolvedAt: null }),
        buildAlert({ id: "al-3", description: "Missing assets", status: "resolved", resolvedAt: "2025-10-19T00:00:00Z" }),
      ];

      const breakdown = calculateTotalAlertsByDescription(alerts);
      expect(breakdown).toHaveLength(2);
      const top = breakdown[0];
      expect(top.description).toBe("Income mismatch");
      expect(top.count).toBe(1); // Only counts open alerts
      expect(top.openCount).toBe(1);
      expect(top.resolvedCount).toBe(1);
      expect(top.percentage).toBeCloseTo(100, 0); // 1 out of 1 open alert
    });
  });

  describe("calculateAvgAlertAge", () => {
    it("computes average, median, and backlog metrics", () => {
      const alerts: AlertWithMatch[] = [
        buildAlert({ id: "backlog-1", status: "new", resolvedAt: null, alertDate: isoLocal(2025, 9, 15) }),
        buildAlert({ id: "backlog-2", status: "acknowledged", resolvedAt: null, alertDate: isoLocal(2025, 8, 1) }),
        buildAlert({ id: "backlog-3", status: "resolved", resolvedAt: isoLocal(2025, 9, 18) }),
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
      const case1 = buildCase({ id: "case-1", status: CASE_STATUS.Active });
  case1.caseRecord.createdDate = isoLocal(2025, 9, 1);
      const case2 = buildCase({ id: "case-2", status: CASE_STATUS.Closed });
  case2.caseRecord.createdDate = isoLocal(2025, 9, 5);
      const case3 = buildCase({ id: "case-3", status: CASE_STATUS.Closed });
  case3.caseRecord.createdDate = isoLocal(2025, 7, 20);

      const cases: CaseDisplay[] = [case1, case2, case3];

      const activity: CaseActivityEntry[] = [
        {
          id: "act-1",
          type: "status-change",
          timestamp: isoLocal(2025, 9, 10, 12),
          caseId: "case-1",
          caseName: "Case 1",
          payload: { toStatus: "Approved", fromStatus: "Pending" },
        },
        {
          id: "act-2",
          type: "status-change",
          timestamp: isoLocal(2025, 9, 18, 9),
          caseId: "case-2",
          caseName: "Case 2",
          payload: { toStatus: "Denied", fromStatus: "Pending" },
        },
        {
          id: "act-3",
          type: "status-change",
          timestamp: isoLocal(2025, 8, 5, 9),
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
