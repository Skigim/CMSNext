import { describe, expect, it } from "vitest";
import { serializeDailyActivityReport } from "../../utils/activityReport";
import type {
  CaseActivityEntry,
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
      notesAdded: entries.filter(entry => entry.type === "note-added").length,
    },
    entries,
    cases,
  });

  it("formats notes and resolved alerts using the activity export template", () => {
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
        notesAdded: 1,
        entries: [statusEntry, noteEntry],
      },
    ]);

    const txt = serializeDailyActivityReport(report, "txt");

    expect(txt).toBe(
      [
        "12345 - Alice Example",
        "",
        "Alerts Cleared:",
        "1. Alert marked Resolved (previously In Progress)",
        "",
        "Notes:",
        "Follow-up:",
        "* Client provided bank statements for upload and shared confirmation numbers for pending deposits.",
        "",
        "-----",
      ].join("\n"),
    );
  });

  it("falls back to no-alert messaging and handles missing MC numbers", () => {
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
        notesAdded: 1,
        entries: [noteEntry],
      },
    ]);

    const txt = serializeDailyActivityReport(report, "txt");

    expect(txt).toBe(
      [
        "No MC# - Bob Citizen",
        "",
        "Alerts Cleared:",
        "None recorded.",
        "",
        "Notes:",
        "General:",
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
        notesAdded: 0,
        entries: [statusEntry],
      },
    ]);

    expect(serializeDailyActivityReport(report, "txt")).toBe("No note activity recorded.");
  });
});
