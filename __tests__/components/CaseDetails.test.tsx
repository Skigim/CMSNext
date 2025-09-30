import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { createMockCaseDisplay } from "@/src/test/testUtils";
import type { AlertWithMatch } from "@/utils/alertsData";

const caseSectionPropsSpy = vi.fn();
const notesSectionPropsSpy = vi.fn();
const statusBadgePropsSpy = vi.fn();
const clickToCopyMock = vi.fn();

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="resizable-group">{children}</div>
  ),
  ResizablePanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="resizable-panel">{children}</div>
  ),
  ResizableHandle: () => <div data-testid="resizable-handle" />,
}));

vi.mock("@/components/case/CaseSection", () => ({
  CaseSection: (props: any) => {
    caseSectionPropsSpy(props);
    return (
      <button
        type="button"
        data-testid={`case-section-${props.category}`}
        onClick={() =>
          props.onUpdateFullItem?.(props.category, "item-1", {
            id: "item-1",
            description: "Mock item",
            amount: 100,
            location: "Test",
            accountNumber: "1234",
            verificationStatus: "Needs VR",
            notes: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        }
      >
        {props.title}
      </button>
    );
  },
}));

vi.mock("@/components/case/NotesSection", () => ({
  NotesSection: (props: any) => {
    notesSectionPropsSpy(props);
    return <div data-testid="notes-section">Mock Notes ({props.notes.length})</div>;
  },
}));

vi.mock("@/components/case/CaseStatusBadge", () => ({
  CaseStatusBadge: (props: any) => {
    statusBadgePropsSpy(props);
    return (
      <button
        type="button"
        data-testid="status-badge"
        onClick={() => props.onStatusChange?.("Approved")}
      >
        {props.status}
      </button>
    );
  },
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock("@/utils/clipboard", () => ({
  clickToCopy: (...args: unknown[]) => clickToCopyMock(...args),
}));

import { CaseDetails } from "@/components/case/CaseDetails";

afterEach(() => {
  vi.clearAllMocks();
});

describe("CaseDetails", () => {
  it("renders case information and handles user interactions", async () => {
    const user = userEvent.setup();
    const caseData = createMockCaseDisplay();
    const timestamp = new Date().toISOString();
    const mockAlert: AlertWithMatch = {
      id: "alert-1",
      reportId: "alert-1",
      alertCode: "AL-1",
      alertType: "Notice",
      severity: "High",
      alertDate: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      mcNumber: caseData.mcn,
      description: "Check status",
      status: "new",
      matchStatus: "matched",
      matchedCaseId: caseData.id,
    };

    const onBack = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onAddItem = vi.fn();
    const onDeleteItem = vi.fn();
    const onBatchUpdateItem = vi.fn().mockResolvedValue(undefined);
    const onCreateItem = vi.fn();
    const onAddNote = vi.fn();
    const onEditNote = vi.fn();
    const onDeleteNote = vi.fn();
    const onBatchUpdateNote = vi.fn();
    const onBatchCreateNote = vi.fn();
    const onUpdateStatus = vi.fn();

    clickToCopyMock.mockResolvedValue(true);

    render(
      <CaseDetails
        case={caseData}
        onBack={onBack}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddItem={onAddItem}
        onDeleteItem={onDeleteItem}
        onBatchUpdateItem={onBatchUpdateItem}
        onCreateItem={onCreateItem}
        onAddNote={onAddNote}
        onEditNote={onEditNote}
        onDeleteNote={onDeleteNote}
        onBatchUpdateNote={onBatchUpdateNote}
        onBatchCreateNote={onBatchCreateNote}
        alerts={[mockAlert]}
        onUpdateStatus={onUpdateStatus}
      />
    );

    expect(screen.getByRole("heading", { name: caseData.name })).toBeInTheDocument();
    expect(screen.getByText(/1 alert linked to this case/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);

  const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
  await user.click(deleteButtons[0]);
    await user.click(screen.getByRole("button", { name: /delete case/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);

    const copyButton = screen.getByRole("button", { name: /copy mcn to clipboard/i });
    await user.click(copyButton);
    expect(clickToCopyMock).toHaveBeenCalledWith(
      caseData.mcn,
      expect.objectContaining({ successMessage: expect.stringContaining(caseData.mcn) })
    );

    await user.click(screen.getByTestId("status-badge"));
    expect(onUpdateStatus).toHaveBeenCalledWith(caseData.id, "Approved");

    const resourcesSection = screen.getByTestId("case-section-resources");
    await user.click(resourcesSection);
    expect(onBatchUpdateItem).toHaveBeenCalledWith(
      "resources",
      "item-1",
      expect.objectContaining({ id: "item-1" })
    );

    expect(caseSectionPropsSpy).toHaveBeenCalled();
    expect(notesSectionPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ notes: caseData.caseRecord.notes })
    );
    expect(statusBadgePropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: caseData.status })
    );
  });
});
