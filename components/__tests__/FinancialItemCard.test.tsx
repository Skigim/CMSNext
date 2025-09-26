import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FinancialItemCard } from "@/components/financial/FinancialItemCard";
import { createMockFinancialItem } from "@/src/test/testUtils";

const createItem = () =>
  createMockFinancialItem("income", {
    id: "income-1",
    description: "Salary",
    amount: 2500,
    verificationStatus: "Needs VR",
    frequency: "monthly",
  });

describe("FinancialItemCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("opens in edit mode when clicked and persists changes on save", async () => {
    const item = createItem();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn();
    const user = userEvent.setup();

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={onDelete}
        onUpdate={onUpdate}
      />
    );

    expect(screen.queryByLabelText(/description/i)).not.toBeInTheDocument();

    await user.click(screen.getByText(/salary/i));
    const descriptionField = await screen.findByLabelText(/description/i);
    await user.clear(descriptionField);
    await user.type(descriptionField, "Updated salary");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        "income",
        "income-1",
        expect.objectContaining({ description: "Updated salary" })
      );
    });
  });

  it("allows cancelling edits without persisting changes", async () => {
    const item = createItem();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn();
    const user = userEvent.setup();

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={onDelete}
        onUpdate={onUpdate}
      />
    );

    await user.click(screen.getByText(/salary/i));
    const descriptionField = await screen.findByLabelText(/description/i);
    await user.clear(descriptionField);
    await user.type(descriptionField, "Cancelled change");

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/description/i)).not.toBeInTheDocument();
    });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("confirms deletion before invoking onDelete", async () => {
    const item = createItem();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={onDelete}
        onUpdate={onUpdate}
        isEditing
      />
    );

    const deleteTrigger = container.querySelector(
      ".financial-item-delete-btn"
    ) as HTMLButtonElement;
    expect(deleteTrigger).toBeTruthy();

    await user.click(deleteTrigger);

    const confirmButton = container.querySelector(
      ".financial-item-confirm-btn--approve"
    ) as HTMLButtonElement;
    expect(confirmButton).toBeTruthy();

    await user.click(confirmButton);

    expect(onDelete).toHaveBeenCalledWith("income", "income-1");
  });

  it("updates verification status through the dropdown menu", async () => {
    const item = createItem();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn();
    const user = userEvent.setup();

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={onDelete}
        onUpdate={onUpdate}
      />
    );

    await user.click(screen.getByRole("button", { name: /needs vr/i }));
    await user.click(await screen.findByRole("menuitem", { name: /verified/i }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        "income",
        "income-1",
        expect.objectContaining({ verificationStatus: "Verified" })
      );
    });
  });
});
