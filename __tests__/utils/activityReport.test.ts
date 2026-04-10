import { describe, expect, it } from "vitest";
import {
  generateDailyActivityReport,
  serializeDailyActivityReport,
  toActivityDateKey,
} from "@/utils/activityReport";
import type {
  CaseActivityEntry,
  CaseApplicationStatusChangeActivity,
  DailyActivityReport,
  DailyCaseActivityBreakdown,
} from "../../types/activityLog";

describe("serializeDailyActivityReport - txt format", () => {
  const buildReport = (
    entries: CaseActivityEntry[],
    cases: DailyCaseActivityBreakdown[],
  ): DailyActivityReport => ({
    date: "2025-10-05",
    totals: {
      total: entries.length,
      statusChanges: entries.filter(entry => entry.type === "status-change").length,
      priorityChanges: entries.filter(entry => entry.type === "priority-change").length,
      notesAdded: entries.filter(entry => entry.type === "note-added").length,
      applicationChanges: entries.filter(
        entry =>
          entry.type === "application-added" ||
          entry.type === "application-updated" ||
          entry.type === "application-status-change",
      ).length,
    },
    entries,
    cases,
  });

  it("formats notes using the stripped-down activity export template", () => {
    const statusEntry: CaseActivityEntry = {
      id: "status-1",
      timestamp: "2025-10-05T14:00:00.000Z",
      caseId: "case-1",
      caseName: "Alice Example",
      caseMcn: "12345",
      type: "status-change",
      payload: {
        fromStatus: "In Progress",
        toStatus: "Resolved",
      },
    };

    const noteEntry: CaseActivityEntry = {
      id: "note-1",
      timestamp: "2025-10-05T15:30:00.000Z",
      caseId: "case-1",
      caseName: "Alice Example",
      caseMcn: "12345",
      type: "note-added",
      payload: {
        noteId: "note-1",
        category: "Follow-up",
        preview: "Client provided bank statements for upload…",
        content: "Client provided bank statements for upload and shared confirmation numbers for pending deposits.",
      },
    };

    const report = buildReport([statusEntry, noteEntry], [
      {
        caseId: "case-1",
        caseName: "Alice Example",
        caseMcn: "12345",
        statusChanges: 1,
        priorityChanges: 0,
        notesAdded: 1,
        applicationChanges: 0,
        entries: [statusEntry, noteEntry],
      },
    ]);

    const txt = serializeDailyActivityReport(report, "txt");

    expect(txt).toBe(
      [
        "12345 - Alice Example",
        "",
        "Follow-up",
        "* Client provided bank statements for upload and shared confirmation numbers for pending deposits.",
        "",
        "-----",
      ].join("\n"),
    );
  });

  it("handles missing MC numbers and normalizes whitespace", () => {
    const noteEntry: CaseActivityEntry = {
      id: "note-2",
      timestamp: "2025-10-05T16:45:00.000Z",
      caseId: "case-2",
      caseName: "Bob Citizen",
      caseMcn: null,
      type: "note-added",
      payload: {
        noteId: "note-2",
        category: "General",
        preview: "  Scheduled   follow-up   call on   Monday.  ",
        content: "  Scheduled   follow-up   call on   Monday.  ",
      },
    };

    const report = buildReport([noteEntry], [
      {
        caseId: "case-2",
        caseName: "Bob Citizen",
        caseMcn: null,
        statusChanges: 0,
        priorityChanges: 0,
        notesAdded: 1,
        applicationChanges: 0,
        entries: [noteEntry],
      },
    ]);

    const txt = serializeDailyActivityReport(report, "txt");

    expect(txt).toBe(
      [
        "No MC# - Bob Citizen",
        "",
        "General",
        "* Scheduled follow-up call on Monday.",
        "",
        "-----",
      ].join("\n"),
    );
  });

  it("returns a friendly message when no notes or cleared alerts are available", () => {
    const statusEntry: CaseActivityEntry = {
      id: "status-2",
      timestamp: "2025-10-05T12:00:00.000Z",
      caseId: "case-3",
      caseName: "Carol Client",
      caseMcn: "67890",
      type: "status-change",
      payload: {
        fromStatus: "Pending",
        toStatus: "In Progress",
      },
    };

    const report = buildReport([statusEntry], [
      {
        caseId: "case-3",
        caseName: "Carol Client",
        caseMcn: "67890",
        statusChanges: 1,
        priorityChanges: 0,
        notesAdded: 0,
        applicationChanges: 0,
        entries: [statusEntry],
      },
    ]);

    expect(serializeDailyActivityReport(report, "txt")).toBe("No note activity recorded.");
  });
});

describe("generateDailyActivityReport", () => {
  it("counts application activity in daily totals and case breakdowns", () => {
    // ARRANGE
    const applicationAddedEntry: CaseActivityEntry = {
      id: "application-added-1",
      timestamp: "2025-10-05T09:00:00.000Z",
      caseId: "case-1",
      caseName: "Alice Example",
      caseMcn: "12345",
      type: "application-added",
      payload: {
        applicationId: "app-1",
        applicationType: "Medicaid",
        status: "Pending",
        applicationDate: "2025-10-05",
      },
    };

    const applicationUpdatedEntry: CaseActivityEntry = {
      id: "application-updated-1",
      timestamp: "2025-10-05T10:00:00.000Z",
      caseId: "case-1",
      caseName: "Alice Example",
      caseMcn: "12345",
      type: "application-updated",
      payload: {
        applicationId: "app-1",
        changedFields: ["applicationType"],
      },
    };

    const applicationStatusChangeEntry: CaseApplicationStatusChangeActivity = {
      id: "application-status-change-1",
      timestamp: "2025-10-05T11:00:00.000Z",
      caseId: "case-2",
      caseName: "Bob Citizen",
      caseMcn: "67890",
      type: "application-status-change",
      payload: {
        applicationId: "app-2",
        fromStatus: "Pending",
        toStatus: "Closed",
        effectiveDate: "2025-10-05",
        source: "user",
      },
    };

    const noteEntry: CaseActivityEntry = {
      id: "note-3",
      timestamp: "2025-10-05T12:00:00.000Z",
      caseId: "case-2",
      caseName: "Bob Citizen",
      caseMcn: "67890",
      type: "note-added",
      payload: {
        noteId: "note-3",
        category: "General",
        preview: "Followed up with applicant.",
      },
    };

    // ACT
    const report = generateDailyActivityReport(
      [applicationAddedEntry, applicationUpdatedEntry, applicationStatusChangeEntry, noteEntry],
      "2025-10-05",
    );

    // ASSERT
    expect(report.totals).toEqual({
      total: 4,
      statusChanges: 0,
      priorityChanges: 0,
      notesAdded: 1,
      applicationChanges: 3,
    });
    expect(report.cases).toEqual([
      {
        caseId: "case-1",
        caseName: "Alice Example",
        caseMcn: "12345",
        statusChanges: 0,
        priorityChanges: 0,
        notesAdded: 0,
        applicationChanges: 2,
        entries: [applicationUpdatedEntry, applicationAddedEntry],
      },
      {
        caseId: "case-2",
        caseName: "Bob Citizen",
        caseMcn: "67890",
        statusChanges: 0,
        priorityChanges: 0,
        notesAdded: 1,
        applicationChanges: 1,
        entries: [noteEntry, applicationStatusChangeEntry],
      },
    ]);
  });

  it("rejects impossible calendar dates instead of rolling them forward", () => {
    // ARRANGE / ACT / ASSERT
    expect(() => toActivityDateKey("2025-02-30")).toThrow(
      "Invalid date provided to toActivityDateKey",
    );
  });
});
