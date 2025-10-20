import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { FormEvent } from "react";
import { createMockFinancialItem } from "@/src/test/testUtils";
import type { FinancialItem } from "@/types/case";
import type { NormalizedFinancialFormData } from "@/components/financial/useFinancialItemCardState";

const headerMock = vi.fn();
const metaMock = vi.fn();
const actionsMock = vi.fn();
const formMock = vi.fn();
const indicatorMock = vi.fn();

vi.mock("@/components/financial/FinancialItemSaveIndicator", () => ({
  FinancialItemSaveIndicator: ({ isSaving, saveSuccessVisible }: { isSaving: boolean; saveSuccessVisible: boolean }) => {
    indicatorMock({ isSaving, saveSuccessVisible });
    return (
      <div data-testid="save-indicator">
        {isSaving ? "saving" : saveSuccessVisible ? "saved" : "idle"}
      </div>
    );
  },
}));

vi.mock("@/components/financial/FinancialItemCardHeader", () => ({
  FinancialItemCardHeader: (props: unknown) => {
    headerMock(props);
    const { displayName } = props as { displayName?: string | null };
    return <div data-testid="financial-card-header">{displayName}</div>;
  },
}));

vi.mock("@/components/financial/FinancialItemCardMeta", () => ({
  FinancialItemCardMeta: ({ canUpdateStatus, onStatusChange }: { canUpdateStatus: boolean; onStatusChange: (status: string) => void }) => {
    metaMock({ canUpdateStatus });
    return (
      <button
        type="button"
        data-testid="status-trigger"
        disabled={!canUpdateStatus}
        onClick={event => {
          event.stopPropagation();
          onStatusChange("Verified");
        }}
      >
        status
      </button>
    );
  },
}));

vi.mock("@/components/financial/FinancialItemCardActions", () => ({
  FinancialItemCardActions: ({ confirmingDelete, onDeleteClick, onDeleteConfirm }: { confirmingDelete: boolean; onDeleteClick: () => void; onDeleteConfirm: () => void }) => {
    actionsMock({ confirmingDelete });
    return (
      <div data-testid="card-actions">
        {confirmingDelete ? (
          <>
            <button type="button" aria-label="Confirm delete financial item" onClick={onDeleteConfirm}>
              confirm delete
            </button>
            <button type="button" aria-label="Cancel delete financial item" onClick={onDeleteClick}>
              cancel delete
            </button>
          </>
        ) : (
          <button type="button" aria-label="Delete financial item" onClick={onDeleteClick}>
            delete
          </button>
        )}
      </div>
    );
  },
}));

vi.mock("@/components/financial/FinancialItemCardForm", () => ({
  FinancialItemCardForm: ({ formData, onFieldChange, onCancel, onSubmit }: { formData: NormalizedFinancialFormData; onFieldChange: (field: string, value: string) => void; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) => {
    formMock(formData);
    return (
      <form
        data-testid="financial-item-form"
        onSubmit={event => {
          event.preventDefault();
          void onSubmit(event as unknown as FormEvent<HTMLFormElement>);
        }}
      >
        <label htmlFor="description-input">Description</label>
        <input
          id="description-input"
          aria-label="Description"
          value={formData.description ?? ""}
          onChange={event => onFieldChange("description", event.target.value)}
        />
        <button type="button" onClick={onCancel}>
          cancel
        </button>
        <button type="submit">save</button>
      </form>
    );
  },
}));

import { FinancialItemCard } from "@/components/financial/FinancialItemCard";

afterEach(() => {
  vi.clearAllMocks();
});

describe("FinancialItemCard", () => {
  it("enters edit mode, saves changes, and exits", async () => {
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", { id: "item-1", description: "Paycheck", verificationStatus: "Needs VR" }) as FinancialItem;

    const onDelete = vi.fn();
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={onDelete}
        onUpdate={onUpdate}
      />
    );

    const cardBody = container.querySelector(".cursor-pointer") as HTMLElement;
    expect(cardBody).toBeTruthy();

    await user.click(cardBody);
    expect(screen.getByTestId("financial-item-form")).toBeInTheDocument();

    const descriptionInput = screen.getByLabelText("Description");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Updated Paycheck");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith("income", "item-1", expect.objectContaining({ description: "Updated Paycheck" }));
    });

    await vi.waitFor(() => {
      expect(screen.queryByTestId("financial-item-form")).not.toBeInTheDocument();
    });
  });

  it("handles delete confirmation flow", async () => {
    const user = userEvent.setup();
    const item = createMockFinancialItem("resources", { id: "res-1", description: "Savings" }) as FinancialItem;
    const onDelete = vi.fn();

    render(
      <FinancialItemCard
        item={item}
        itemType="resources"
        onDelete={onDelete}
        onUpdate={vi.fn()}
        isEditing
      />
    );

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    await vi.waitFor(() => {
      expect(actionsMock).toHaveBeenCalledWith(expect.objectContaining({ confirmingDelete: true }));
    });

    const confirmButton = screen.getByRole("button", { name: /confirm delete financial item/i });
    await user.click(confirmButton);

    expect(onDelete).toHaveBeenCalledWith("resources", "res-1");

    const saveIndicatorStates = indicatorMock.mock.calls.map(call => call[0]);
    expect(saveIndicatorStates).toContainEqual({ isSaving: false, saveSuccessVisible: false });
  });

  it("disables status control when updates are unavailable", () => {
    const item = createMockFinancialItem("expenses", { id: "exp-1", description: "Rent" }) as FinancialItem;

    render(
      <FinancialItemCard
        item={item}
        itemType="expenses"
        onDelete={vi.fn()}
        showActions={false}
      />
    );

    const statusButton = screen.getByTestId("status-trigger");
    expect(statusButton).toBeDisabled();
  });

  it("invokes skeleton cancel handler when editing a new card", async () => {
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", {
      id: "fallback-1234",
      description: "",
      amount: 0,
      verificationStatus: "Needs VR",
      dateAdded: new Date().toISOString(),
    }) as FinancialItem;

    const onDelete = vi.fn();

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={onDelete}
        isSkeleton
        isEditing
      />
    );

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("should have accessible delete confirmation buttons", async () => {
    const user = userEvent.setup();
    const item = createMockFinancialItem("resources", { id: "res-1", description: "Savings" }) as FinancialItem;
    const onDelete = vi.fn();

    render(
      <FinancialItemCard
        item={item}
        itemType="resources"
        onDelete={onDelete}
        onUpdate={vi.fn()}
        isEditing
      />
    );

    const deleteButton = screen.getByRole("button", { name: /delete financial item/i });
    expect(deleteButton).toHaveAttribute("aria-label");
    
    await user.click(deleteButton);

    // Verify confirmation buttons appear and have proper labels
    const confirmButton = screen.queryByRole("button", { name: /confirm delete/i });
    const cancelDeleteButton = screen.queryByRole("button", { name: /cancel delete/i });
    
    expect(confirmButton).toBeInTheDocument();
    expect(confirmButton).toHaveAttribute("aria-label");
    
    expect(cancelDeleteButton).toBeInTheDocument();
    expect(cancelDeleteButton).toHaveAttribute("aria-label");
  });

  it("preserves form data when status is changed before saving", async () => {
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", { 
      id: "item-1", 
      description: "", 
      amount: 0,
      verificationStatus: "Needs VR" 
    }) as FinancialItem;

    const onUpdate = vi.fn().mockResolvedValue(undefined);

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onUpdate={onUpdate}
        isEditing
      />
    );

    // Enter form data
    const descriptionInput = screen.getByLabelText("Description");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "New Paycheck");

    // Verify form data was entered
    expect(descriptionInput).toHaveValue("New Paycheck");

    // Change status before saving
    const statusButton = screen.getByTestId("status-trigger");
    await user.click(statusButton);

    // Verify onUpdate was called with the updated status
    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        "income", 
        "item-1", 
        expect.objectContaining({ 
          description: "New Paycheck",  // Form data should be preserved
          verificationStatus: "Verified"
        })
      );
    });

    // Verify the form still shows the entered data after status change
    expect(descriptionInput).toHaveValue("New Paycheck");
  });
});
