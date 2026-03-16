import { axe } from "jest-axe";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActivityWidget } from "@/components/app/widgets/ActivityWidget";
import type {
  CaseActivityEntry,
  CaseActivityLogState,
  DailyActivityReport,
} from "@/types/activityLog";

vi.mock("@/hooks/useDataSync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useDataSync")>();
  return {
    ...actual,
    useDataChangeCount: () => 0,
  };
});

function createEmptyReport(): DailyActivityReport {
  return {
    date: "2025-10-05",
    totals: {
      total: 0,
      statusChanges: 0,
      priorityChanges: 0,
      notesAdded: 0,
    },
    entries: [],
    cases: [],
  };
}

function createActivityLogState(activityLog: CaseActivityEntry[]): CaseActivityLogState {
  return {
    activityLog,
    dailyReports: [],
    todayReport: null,
    yesterdayReport: null,
    loading: false,
    error: null,
    refreshActivityLog: vi.fn().mockResolvedValue(undefined),
    getReportForDate: vi.fn(() => createEmptyReport()),
    clearReportForDate: vi.fn().mockResolvedValue(0),
  };
}

describe("ActivityWidget", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.localStorage.setItem("cmsnext-error-reports", "[]");
    globalThis.localStorage.setItem("cmsnext-pinned-cases", "[]");
    globalThis.localStorage.setItem("cmsnext-pinned-case-reasons", "{}");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("consolidates recent activity to one row per case and opens a detail dialog", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const now = Date.now();
    const activityLog: CaseActivityEntry[] = [
      {
        id: "view-1",
        timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
        caseId: "case-1",
        caseName: "Jamie Rivera",
        caseMcn: "MCN123",
        type: "case-viewed",
        payload: {},
      },
      {
        id: "note-1",
        timestamp: new Date(now - 45 * 60 * 1000).toISOString(),
        caseId: "case-1",
        caseName: "Jamie Rivera",
        caseMcn: "MCN123",
        type: "note-added",
        payload: {
          noteId: "note-1",
          category: "Follow-up",
          preview: "Client called back with verification details.",
        },
      },
      {
        id: "status-1",
        timestamp: new Date(now - 75 * 60 * 1000).toISOString(),
        caseId: "case-1",
        caseName: "Jamie Rivera",
        caseMcn: "MCN123",
        type: "status-change",
        payload: {
          fromStatus: "Pending",
          toStatus: "Approved",
        },
      },
      {
        id: "view-2",
        timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        caseId: "case-2",
        caseName: "Morgan Lee",
        caseMcn: "MCN456",
        type: "case-viewed",
        payload: {},
      },
    ];
    const onViewCase = vi.fn();

    render(<ActivityWidget activityLogState={createActivityLogState(activityLog)} onViewCase={onViewCase} />);

    // ACT
    const jamieRow = await screen.findByRole("button", { name: "View activity for Jamie Rivera" });

    // ASSERT
    expect(screen.getAllByRole("button", { name: /View activity for /i })).toHaveLength(2);
    expect(jamieRow).toBeInTheDocument();
    expect(screen.getByText("3 actions · 1 view · 1 status · 1 note")).toBeInTheDocument();

    await user.click(jamieRow);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Activity for Jamie Rivera")).toBeInTheDocument();
    expect(within(dialog).getByText("Status: Pending → Approved")).toBeInTheDocument();
    expect(within(dialog).getByText("Note added")).toBeInTheDocument();
    expect(within(dialog).getByText("Case viewed")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Open case" }));

    expect(onViewCase).toHaveBeenCalledWith("case-1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    // ARRANGE
    const now = Date.now();
    const activityLog: CaseActivityEntry[] = [
      {
        id: "view-1",
        timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
        caseId: "case-1",
        caseName: "Jamie Rivera",
        caseMcn: "MCN123",
        type: "case-viewed",
        payload: {},
      },
    ];

    // ACT
    const { container } = render(
      <ActivityWidget activityLogState={createActivityLogState(activityLog)} onViewCase={vi.fn()} />
    );
    await screen.findByRole("button", { name: "View activity for Jamie Rivera" });

    // ASSERT
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
