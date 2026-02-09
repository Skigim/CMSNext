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
  it("should render copy button", () => {
    render(
      <FinancialItemCardActions
        item={mockItem}
        itemType={mockItemType}
      />
    );

    expect(screen.getByRole("button", { name: /copy financial item to clipboard/i })).toBeInTheDocument();
  });

  it("should render calendar button when onHistoryClick is provided", () => {
    render(
      <FinancialItemCardActions
        onHistoryClick={vi.fn()}
        item={mockItem}
        itemType={mockItemType}
      />
    );

    expect(screen.getByRole("button", { name: /view amount history/i })).toBeInTheDocument();
  });

  it("should not render calendar button when onHistoryClick is not provided", () => {
    render(
      <FinancialItemCardActions
        item={mockItem}
        itemType={mockItemType}
      />
    );

    expect(screen.queryByRole("button", { name: /view amount history/i })).not.toBeInTheDocument();
  });

  it("should call onHistoryClick when calendar button is clicked", async () => {
    const user = userEvent.setup();
    const onHistoryClick = vi.fn();

    render(
      <FinancialItemCardActions
        onHistoryClick={onHistoryClick}
        item={mockItem}
        itemType={mockItemType}
      />
    );

    await user.click(screen.getByRole("button", { name: /view amount history/i }));
    expect(onHistoryClick).toHaveBeenCalledTimes(1);
  });

  it("should have proper ARIA labels on buttons", () => {
    render(
      <FinancialItemCardActions
        onHistoryClick={vi.fn()}
        item={mockItem}
        itemType={mockItemType}
      />
    );

    const historyButton = screen.getByRole("button", { name: /view amount history/i });
    const copyButton = screen.getByRole("button", { name: /copy financial item to clipboard/i });
    
    expect(historyButton).toHaveAttribute("aria-label");
    expect(copyButton).toHaveAttribute("aria-label");
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
        item={mockItem}
        itemType={mockItemType}
      />
    );

    const copyButton = screen.getByRole("button", { name: /copy financial item to clipboard/i });
    await user.click(copyButton);

    expect(writeTextMock).toHaveBeenCalled();

    // Restore original clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });
});
