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
    resolvedAt: partial.resolvedAt === undefined ? "2025-10-21T00:00:00Z" : partial.resolvedAt,
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

type ProcessedCountOptions = Parameters<typeof calculateCasesProcessedPerDay>[1];

const processedCountDate = "2025-10-21";
const processedTimes = {
  previousMorning: isoLocal(2025, 9, 20, 9, 0, 0),
  previousAfternoon: isoLocal(2025, 9, 20, 14, 0, 0),
  morning: isoLocal(2025, 9, 21, 9, 0, 0),
  afternoon: isoLocal(2025, 9, 21, 14, 0, 0),
  laterAfternoon: isoLocal(2025, 9, 21, 16, 0, 0),
  evening: isoLocal(2025, 9, 21, 17, 0, 0),
} as const;
const requireNoteOnSameDay: ProcessedCountOptions = {
  requireNoteOnSameDay: true,
};

function buildStatusChangeEntry(
  partial: {
    id?: string;
    timestamp: string;
    caseId?: string;
    caseName?: string;
    fromStatus?: string;
    toStatus?: string;
  }
): CaseActivityEntry {
  return {
    id: partial.id ?? "status-change-1",
    type: "status-change",
    timestamp: partial.timestamp,
    caseId: partial.caseId ?? "case-1",
    caseName: partial.caseName ?? "Case 1",
    payload: {
      fromStatus: partial.fromStatus,
      toStatus: partial.toStatus,
    },
  } as CaseActivityEntry;
}

function buildNoteAddedEntry(
  partial: {
    id?: string;
    timestamp: string;
    caseId?: string;
    caseName?: string;
    noteId?: string;
    category?: string;
    preview?: string;
  }
): CaseActivityEntry {
  return {
    id: partial.id ?? "note-added-1",
    type: "note-added",
    timestamp: partial.timestamp,
    caseId: partial.caseId ?? "case-1",
    caseName: partial.caseName ?? "Case 1",
    payload: {
      noteId: partial.noteId ?? "note-1",
      category: partial.category ?? "General",
      preview: partial.preview ?? "Reviewed documentation",
    },
  } as CaseActivityEntry;
}

function getProcessedCountForReferenceDate(
  activityLog: CaseActivityEntry[],
  date = processedCountDate,
  options: ProcessedCountOptions = {}
): number | undefined {
  const stats = calculateCasesProcessedPerDay(activityLog, {
    referenceDate,
    ...options,
  });

  return stats.find((entry) => entry.date === date)?.processedCount;
}

function getProcessedCountRequiringSameDayNote(
  activityLog: CaseActivityEntry[],
  date = processedCountDate
): number | undefined {
  return getProcessedCountForReferenceDate(
    activityLog,
    date,
    requireNoteOnSameDay
  );
}

function buildPendingToApprovedEntry(
  timestamp = processedTimes.afternoon,
  partial: Omit<Parameters<typeof buildStatusChangeEntry>[0], "timestamp" | "fromStatus" | "toStatus"> = {}
): CaseActivityEntry {
  return buildStatusChangeEntry({
    timestamp,
    fromStatus: "Pending",
    toStatus: "Approved",
    ...partial,
  });
}

describe("widgetDataProcessors", () => {
  describe("calculateAlertsClearedPerDay", () => {
    it("counts resolved alerts across the last seven days", () => {
      // ARRANGE
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

      // ACT
      const stats = calculateAlertsClearedPerDay(alerts, { referenceDate });

      // ASSERT
      expect(stats).toHaveLength(7);
      const counts = stats.map((entry) => entry.clearedCount);
      expect(counts.reduce((sum, value) => sum + value, 0)).toBe(3);
      const latestDay = stats[stats.length - 1];
      expect(latestDay.date).toBe("2025-10-22");
      expect(latestDay.clearedCount).toBe(1);
    });

    it("handles empty input", () => {
      // ARRANGE

      // ACT
      const stats = calculateAlertsClearedPerDay([], { referenceDate });

      // ASSERT
      expect(stats).toHaveLength(7);
      expect(stats.map((entry) => entry.clearedCount)).toEqual([
        0, 0, 0, 0, 0, 0, 0,
      ]);
    });
  });

  describe("calculateCasesProcessedPerDay", () => {
    it("groups completed status changes", () => {
      // ARRANGE
      const day21 = isoLocal(2025, 9, 21, 14, 0, 0);
      const day20 = isoLocal(2025, 9, 20, 9, 0, 0);
      const day15 = isoLocal(2025, 9, 15, 10, 0, 0);
      const day22 = isoLocal(2025, 9, 22, 11, 0, 0);

      const activity: CaseActivityEntry[] = [
        buildStatusChangeEntry({ id: "c1", timestamp: day21, toStatus: "Approved" }),
        buildStatusChangeEntry({
          id: "c2",
          timestamp: day20,
          caseId: "case-2",
          caseName: "Case 2",
          toStatus: "Closed",
        }),
        buildStatusChangeEntry({
          id: "c3",
          timestamp: day15,
          caseId: "case-3",
          caseName: "Case 3",
          toStatus: "Pending",
        }),
        buildNoteAddedEntry({
          id: "c4",
          timestamp: day22,
          caseId: "case-4",
          caseName: "Case 4",
          preview: "note",
        }),
      ];

      // ACT
      const stats = calculateCasesProcessedPerDay(activity, { referenceDate });

      // ASSERT
      expect(stats).toHaveLength(7);
      expect(
        stats.map((entry) => entry.processedCount).reduce((sum, value) => sum + value, 0)
      ).toBe(2);
      const day = stats[stats.length - 2];
      expect(day.date).toBe("2025-10-21");
      expect(day.processedCount).toBe(1);
    });

    it("counts as zero when a case reaches terminal and reverts to non-terminal on the same day", () => {
      // ARRANGE
      const activity: CaseActivityEntry[] = [
        buildStatusChangeEntry({
          id: "c1",
          timestamp: processedTimes.afternoon,
          fromStatus: "Pending",
          toStatus: "Approved",
        }),
        buildStatusChangeEntry({
          id: "c2",
          timestamp: processedTimes.laterAfternoon,
          fromStatus: "Approved",
          toStatus: "Pending",
        }),
      ];

      // ACT
      const processedCount = getProcessedCountForReferenceDate(activity);

      // ASSERT
      expect(processedCount).toBe(0);
    });

    it("does not count as processed when the case started the day in a completion status", () => {
      // ARRANGE
      const activity = [
        buildStatusChangeEntry({
          id: "c1",
          timestamp: processedTimes.morning,
          fromStatus: "Approved",
          toStatus: "Pending",
        }),
      ];

      // ACT
      const processedCount = getProcessedCountForReferenceDate(activity);

      // ASSERT
      expect(processedCount).toBe(0);
    });

    it("does not count as processed when a case starts and ends the day in a completion status despite reopening", () => {
      // ARRANGE
      const day21Afternoon = isoLocal(2025, 9, 21, 13, 0, 0);

      const activity: CaseActivityEntry[] = [
        buildStatusChangeEntry({
          id: "c1",
          timestamp: processedTimes.morning,
          fromStatus: "Approved",
          toStatus: "Pending",
        }),
        buildStatusChangeEntry({
          id: "c2",
          timestamp: day21Afternoon,
          fromStatus: "Pending",
          toStatus: "Closed",
        }),
      ];

      // ACT
      const processedCount = getProcessedCountForReferenceDate(activity);

      // ASSERT
      expect(processedCount).toBe(0);
    });

    it("does not change count when moving between completion statuses", () => {
      // ARRANGE
      const activity = [
        buildStatusChangeEntry({
          id: "c1",
          timestamp: processedTimes.afternoon,
          fromStatus: "Approved",
          toStatus: "Denied",
        }),
      ];

      // ACT
      const processedCount = getProcessedCountForReferenceDate(activity);

      // ASSERT
      expect(processedCount).toBe(0);
    });

    describe("requireNoteOnSameDay option", () => {
      it("counts status changes without notes when disabled (default)", () => {
        // ARRANGE
        const activity = [buildPendingToApprovedEntry(processedTimes.afternoon, { id: "c1" })];

        // ACT
        const processedCount = getProcessedCountForReferenceDate(activity);

        // ASSERT
        expect(processedCount).toBe(1);
      });

      it("excludes status changes without notes when enabled", () => {
        // ARRANGE
        const activity = [buildPendingToApprovedEntry(processedTimes.afternoon, { id: "c1" })];

        // ACT
        const processedCount = getProcessedCountRequiringSameDayNote(activity);

        // ASSERT
        expect(processedCount).toBe(0);
      });

      it("counts status changes with notes on the same day when enabled", () => {
        // ARRANGE
        const activity: CaseActivityEntry[] = [
          buildNoteAddedEntry({ id: "n1", timestamp: processedTimes.morning }),
          buildPendingToApprovedEntry(processedTimes.afternoon, { id: "c1" }),
        ];

        // ACT
        const processedCount = getProcessedCountRequiringSameDayNote(activity);

        // ASSERT
        expect(processedCount).toBe(1);
      });

      it("does not count if note is on a different day than status change", () => {
        // ARRANGE
        const activity: CaseActivityEntry[] = [
          buildNoteAddedEntry({ id: "n1", timestamp: processedTimes.previousAfternoon }),
          buildPendingToApprovedEntry(processedTimes.afternoon, { id: "c1" }),
        ];

        // ACT
        const processedCount = getProcessedCountRequiringSameDayNote(activity);

        // ASSERT
        expect(processedCount).toBe(0);
      });

      it("handles multiple cases with mixed note presence", () => {
        // ARRANGE
        const activity: CaseActivityEntry[] = [
          buildNoteAddedEntry({
            id: "n1",
            timestamp: processedTimes.morning,
            preview: "Worked on case",
          }),
          buildPendingToApprovedEntry(processedTimes.afternoon, { id: "c1" }),
          buildStatusChangeEntry({
            id: "c2",
            timestamp: processedTimes.afternoon,
            caseId: "case-2",
            caseName: "Case 2",
            fromStatus: "Pending",
            toStatus: "Closed",
          }),
          buildNoteAddedEntry({
            id: "n3",
            timestamp: processedTimes.afternoon,
            caseId: "case-3",
            caseName: "Case 3",
            noteId: "note-3",
            preview: "Final review",
          }),
          buildStatusChangeEntry({
            id: "c3",
            timestamp: processedTimes.evening,
            caseId: "case-3",
            caseName: "Case 3",
            fromStatus: "Pending",
            toStatus: "Denied",
          }),
        ];

        // ACT
        const processedCount = getProcessedCountRequiringSameDayNote(activity);

        // ASSERT
        expect(processedCount).toBe(2);
      });

      it("still applies reversion logic when requireNoteOnSameDay is enabled", () => {
        // ARRANGE
        const activity: CaseActivityEntry[] = [
          buildNoteAddedEntry({
            id: "n1",
            timestamp: processedTimes.morning,
            preview: "Working on it",
          }),
          buildPendingToApprovedEntry(processedTimes.afternoon, { id: "c1" }),
          buildStatusChangeEntry({
            id: "c2",
            timestamp: processedTimes.evening,
            fromStatus: "Approved",
            toStatus: "Pending",
          }),
        ];

        // ACT
        const processedCount = getProcessedCountRequiringSameDayNote(activity);

        // ASSERT
        expect(processedCount).toBe(0);
      });

      it("does not count a same-day reopen when the case started terminal even if a note exists", () => {
        // ARRANGE
        const activity: CaseActivityEntry[] = [
          buildNoteAddedEntry({
            id: "n1",
            timestamp: processedTimes.morning,
            preview: "Reviewed reopened case",
          }),
          buildStatusChangeEntry({
            id: "c1",
            timestamp: processedTimes.afternoon,
            fromStatus: "Approved",
            toStatus: "Pending",
          }),
        ];

        // ACT
        const processedCount = getProcessedCountRequiringSameDayNote(activity);

        // ASSERT
        expect(processedCount).toBe(0);
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
      // ARRANGE
      const case1 = buildCase({ id: "case-1", status: CASE_STATUS.Active });
      case1.caseRecord.createdDate = isoLocal(2025, 9, 1);
      const case2 = buildCase({ id: "case-2", status: CASE_STATUS.Closed });
      case2.caseRecord.createdDate = isoLocal(2025, 9, 5);
      const case3 = buildCase({ id: "case-3", status: CASE_STATUS.Closed });
      case3.caseRecord.createdDate = isoLocal(2025, 7, 20);

      const cases: CaseDisplay[] = [case1, case2, case3];

      const activity: CaseActivityEntry[] = [
        buildStatusChangeEntry({
          id: "act-1",
          timestamp: isoLocal(2025, 9, 10, 12),
          fromStatus: "Pending",
          toStatus: "Approved",
        }),
        buildStatusChangeEntry({
          id: "act-2",
          timestamp: isoLocal(2025, 9, 18, 9),
          caseId: "case-2",
          caseName: "Case 2",
          fromStatus: "Pending",
          toStatus: "Denied",
        }),
        buildStatusChangeEntry({
          id: "act-3",
          timestamp: isoLocal(2025, 8, 5, 9),
          caseId: "case-3",
          caseName: "Case 3",
          fromStatus: "Pending",
          toStatus: "Closed",
        }),
      ];

      // ACT
      const stats = calculateAvgCaseProcessingTime(activity, cases, {
        referenceDate,
        windowInDays: 30,
      });

      // ASSERT
      expect(stats.sampleSize).toBe(2);
      expect(stats.averageDays).toBeCloseTo(11, 1);
      expect(stats.medianDays).toBeCloseTo(11, 1);
      expect(stats.byStatus.Approved).toBeCloseTo(9, 1);
      expect(stats.byStatus.Denied).toBeCloseTo(13, 1);
      expect(stats.previousAverageDays).toBeCloseTo(16, 1);
    });
  });
});
