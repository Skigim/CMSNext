import { axe } from "jest-axe";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityWidget } from "@/components/app/widgets/ActivityWidget";
import type { CaseActivityEntry } from "@/types/activityLog";
import { createMockCaseActivityLogState } from "@/src/test/testUtils";

vi.mock("@/hooks/useDataSync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useDataSync")>();
  return {
    ...actual,
    useDataChangeCount: () => 0,
  };
});

// Pinning is covered separately; keep this test focused on activity rendering.
vi.mock("@/components/common/PinButton", () => ({
  PinButton: () => <button aria-label="Pin case" type="button">Pin</button>,
}));

describe("ActivityWidget", () => {
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

    render(
      <ActivityWidget
        activityLogState={createMockCaseActivityLogState({ activityLog })}
        onViewCase={onViewCase}
      />,
    );

    // ACT
    const jamieRow = await screen.findByRole("button", { name: "View activity for Jamie Rivera" });

    // ASSERT
    expect(screen.getAllByRole("button", { name: /View activity for /i })).toHaveLength(2);
    expect(jamieRow).toBeInTheDocument();
    expect(screen.getByText("3 actions · 1 view · 1 status · 1 note")).toBeInTheDocument();

    await user.click(jamieRow);

    const dialog = await screen.findByRole("dialog");
    const scrollContainer = within(dialog).getByTestId("activity-detail-scroll-container");
    const scrollArea = within(dialog).getByTestId("activity-detail-scroll-area");
    expect(within(dialog).getByText("Activity for Jamie Rivera")).toBeInTheDocument();
    expect(within(dialog).getByText("Status: Pending → Approved")).toBeInTheDocument();
    expect(within(dialog).getByText("Note added")).toBeInTheDocument();
    expect(within(dialog).getByText("Case viewed")).toBeInTheDocument();
    expect(dialog).toHaveClass("flex", "flex-col", "overflow-hidden");
    expect(scrollContainer).toHaveClass(
      "mt-3",
      "flex",
      "flex-1",
      "flex-col",
      "overflow-hidden",
      "max-h-[50vh]",
      "sm:max-h-[60vh]",
    );
    expect(scrollArea).toHaveClass("h-full", "max-h-[50vh]", "sm:max-h-[60vh]");
    expect(scrollContainer.parentElement).toHaveClass(
      "flex",
      "min-h-0",
      "flex-1",
      "flex-col",
      "overflow-hidden",
    );
    expect(within(dialog).getByRole("button", { name: "Open case" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Open case" }));

    expect(onViewCase).toHaveBeenCalledWith("case-1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uses the latest entry metadata for grouped rows even when there are no view events", async () => {
    // ARRANGE
    const now = Date.now();
    const activityLog: CaseActivityEntry[] = [
      {
        id: "older-status",
        timestamp: new Date(now - 90 * 60 * 1000).toISOString(),
        caseId: "case-3",
        caseName: "Old Name",
        caseMcn: "OLD123",
        type: "status-change",
        payload: {
          fromStatus: "Pending",
          toStatus: "In Progress",
        },
      },
      {
        id: "newer-note",
        timestamp: new Date(now - 5 * 60 * 1000).toISOString(),
        caseId: "case-3",
        caseName: "Updated Name",
        caseMcn: "NEW456",
        type: "note-added",
        payload: {
          noteId: "note-3",
          category: "General",
          preview: "Most recent activity is a note.",
        },
      },
    ];

    render(
      <ActivityWidget
        activityLogState={createMockCaseActivityLogState({ activityLog })}
        onViewCase={vi.fn()}
      />,
    );

    // ACT
    const groupedRow = await screen.findByRole("button", { name: "View activity for Updated Name" });

    // ASSERT
    expect(groupedRow).toBeInTheDocument();
    expect(within(groupedRow).getByText("Note added")).toBeInTheDocument();
    expect(within(groupedRow).getByText("Updated Name")).toBeInTheDocument();
    expect(within(groupedRow).getByText("2 actions · 1 status · 1 note")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy MCN NEW456" })).toBeInTheDocument();
    expect(screen.getByText("Note")).toBeInTheDocument();
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
      <ActivityWidget
        activityLogState={createMockCaseActivityLogState({ activityLog })}
        onViewCase={vi.fn()}
      />
    );
    await screen.findByRole("button", { name: "View activity for Jamie Rivera" });

    // ASSERT
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
