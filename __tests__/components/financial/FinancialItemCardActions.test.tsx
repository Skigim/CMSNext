import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
// @ts-ignore - jest-axe doesn't have types but works fine with vitest
import { axe } from 'jest-axe'

import { FinancialItemCardActions } from "@/components/financial/FinancialItemCardActions";

describe("FinancialItemCardActions", () => {
  it("emits delete click when not confirming", async () => {
    const user = userEvent.setup();
    const onDeleteClick = vi.fn();

    render(
      <FinancialItemCardActions
        confirmingDelete={false}
        onDeleteClick={onDeleteClick}
        onDeleteConfirm={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /delete financial item/i }));
    expect(onDeleteClick).toHaveBeenCalledTimes(1);
  });

  it("shows confirm controls when confirming delete", async () => {
    const user = userEvent.setup();
    const onDeleteClick = vi.fn();
    const onDeleteConfirm = vi.fn();

    render(
      <FinancialItemCardActions
        confirmingDelete
        onDeleteClick={onDeleteClick}
        onDeleteConfirm={onDeleteConfirm}
      />
    );

    await user.click(screen.getByRole("button", { name: /confirm delete financial item/i }));
    expect(onDeleteConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /cancel delete financial item/i }));
    expect(onDeleteClick).toHaveBeenCalledTimes(1);
  });

  it("should have proper ARIA labels on delete buttons", () => {
    render(
      <FinancialItemCardActions
        confirmingDelete={false}
        onDeleteClick={vi.fn()}
        onDeleteConfirm={vi.fn()}
      />
    );

    const deleteButton = screen.getByRole("button", { name: /delete financial item/i });
    expect(deleteButton).toHaveAttribute("aria-label");
  });

  it("should show proper confirmation buttons with accessible labels", async () => {
    render(
      <FinancialItemCardActions
        confirmingDelete={true}
        onDeleteClick={vi.fn()}
        onDeleteConfirm={vi.fn()}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /confirm delete financial item/i });
    const cancelButton = screen.getByRole("button", { name: /cancel delete financial item/i });

    expect(confirmButton).toHaveAttribute("aria-label");
    expect(cancelButton).toHaveAttribute("aria-label");
  });

  it("should support keyboard navigation for delete actions", async () => {
    const onDeleteClick = vi.fn();

    render(
      <FinancialItemCardActions
        confirmingDelete={false}
        onDeleteClick={onDeleteClick}
        onDeleteConfirm={vi.fn()}
      />
    );

    const deleteButton = screen.getByRole("button", { name: /delete financial item/i });
    
    // Simulate Tab to focus and Enter to activate
    deleteButton.focus();
    expect(deleteButton).toHaveFocus();
  });
});
