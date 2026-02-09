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

  it("should not render calendar button anymore", () => {
    render(
      <FinancialItemCardActions
        item={mockItem}
        itemType={mockItemType}
      />
    );

    expect(screen.queryByRole("button", { name: /view amount history/i })).not.toBeInTheDocument();
  });

  it("should have proper ARIA labels on buttons", () => {
    render(
      <FinancialItemCardActions
        item={mockItem}
        itemType={mockItemType}
      />
    );

    const copyButton = screen.getByRole("button", { name: /copy financial item to clipboard/i });
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
