import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

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
});
