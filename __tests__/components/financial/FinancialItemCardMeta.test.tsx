import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode, MouseEvent } from "react";

import { FinancialItemCardMeta } from "@/components/financial/FinancialItemCardMeta";
import { getVerificationStatusInfo } from "@/utils/verificationStatus";
import type { NormalizedFinancialItem } from "@/components/financial/useFinancialItemCardState";

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: (event: MouseEvent<HTMLButtonElement>) => void }) => (
    <button type="button" role="menuitem" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipContent: ({ children }: { children: ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
}));

describe("FinancialItemCardMeta", () => {
  const baseItem: NormalizedFinancialItem = {
    displayName: "Savings Account",
    verificationStatus: "needs vr",
    amount: 2500,
    safeId: "item-123",
    location: "Local Credit Union",
    accountNumber: "9876546789",
    notes: "This is an extended note explaining the account history in great detail.".repeat(3),
    frequency: "monthly",
    verificationSource: "Statement",
    dateAdded: "2024-01-01T00:00:00.000Z",
  };

  it("displays metadata and disables status changes when updates are not allowed", () => {
    render(
      <FinancialItemCardMeta
        normalizedItem={baseItem}
        verificationStatus={getVerificationStatusInfo("Needs VR")}
        canUpdateStatus={false}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText("Local Credit Union")).toBeInTheDocument();
    expect(screen.getByText("****6789")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-content")).toHaveTextContent(/This is an extended note/i);
    expect(screen.getByRole("button", { name: /needs vr/i })).toBeDisabled();
  });

  it("invokes status change handler when menu options are selected", async () => {
    const user = userEvent.setup();
    const handleStatusChange = vi.fn().mockResolvedValue(undefined);

    render(
      <FinancialItemCardMeta
        normalizedItem={baseItem}
        verificationStatus={getVerificationStatusInfo("Needs VR")}
        canUpdateStatus
        onStatusChange={handleStatusChange}
      />
    );

  await user.click(screen.getByRole("menuitem", { name: /verified/i }));
    expect(handleStatusChange).toHaveBeenCalledWith("Verified");
  });
});
