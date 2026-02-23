import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FinancialItemStepperModal } from "@/components/financial/FinancialItemStepperModal";

describe("FinancialItemStepperModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = () =>
    render(
      <FinancialItemStepperModal
        isOpen={true}
        onClose={mockOnClose}
        itemType="resources"
        onSave={mockOnSave}
      />
    );

  it("uses Ctrl+Enter on details step to continue to amount setup", async () => {
    const user = userEvent.setup();
    renderModal();

    const descriptionInput = screen.getByLabelText(/Description \*/i);
    await user.type(descriptionInput, "Checking Account");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(await screen.findByText(/New Entry/i)).toBeInTheDocument();
  });

  it("uses Ctrl+Enter in amount history setup to add an entry", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/Description \*/i), "Savings");
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.type(screen.getByLabelText(/Amount \*/i), "123.45");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(await screen.findByText("$123.45")).toBeInTheDocument();
  });
});
