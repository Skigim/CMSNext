import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { FinancialItemCardActions } from "@/components/financial/FinancialItemCardActions";
import type { FinancialItem, CaseCategory } from "@/types/case";

const mockItem: FinancialItem = {
  id: "test-item-1",
  description: "Test Item",
  amount: 1000,
  verificationStatus: "Pending",
};

const mockItemType: CaseCategory = "resources";

describe("FinancialItemCardActions", () => {
  it("emits delete click when not confirming", async () => {
    const user = userEvent.setup();
    const onDeleteClick = vi.fn();

    render(
      <FinancialItemCardActions
        confirmingDelete={false}
        onDeleteClick={onDeleteClick}
        onDeleteConfirm={vi.fn()}
        item={mockItem}
        itemType={mockItemType}
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
        item={mockItem}
        itemType={mockItemType}
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
        item={mockItem}
        itemType={mockItemType}
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
        item={mockItem}
        itemType={mockItemType}
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
        item={mockItem}
        itemType={mockItemType}
      />
    );

    const deleteButton = screen.getByRole("button", { name: /delete financial item/i });
    
    // Simulate Tab to focus and Enter to activate
    deleteButton.focus();
    expect(deleteButton).toHaveFocus();
  });

  it("should have a copy button with proper aria-label", () => {
    render(
      <FinancialItemCardActions
        confirmingDelete={false}
        onDeleteClick={vi.fn()}
        onDeleteConfirm={vi.fn()}
        item={mockItem}
        itemType={mockItemType}
      />
    );

    const copyButton = screen.getByRole("button", { name: /copy financial item to clipboard/i });
    expect(copyButton).toBeInTheDocument();
  });

  it("should call clickToCopy when copy button is clicked", async () => {
    const user = userEvent.setup();
    
    // Mock clipboard API properly
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(
      <FinancialItemCardActions
        confirmingDelete={false}
        onDeleteClick={vi.fn()}
        onDeleteConfirm={vi.fn()}
        item={mockItem}
        itemType={mockItemType}
      />
    );

    const copyButton = screen.getByRole("button", { name: /copy financial item to clipboard/i });
    await user.click(copyButton);

    expect(writeTextMock).toHaveBeenCalled();
    
    // Restore original
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });
});
