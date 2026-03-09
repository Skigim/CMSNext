import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import { FinancialItemStepperModal } from "@/components/financial/FinancialItemStepperModal";

expect.extend(toHaveNoViolations);

describe("FinancialItemStepperModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (props?: { applicationDate?: string }) =>
    render(
      <FinancialItemStepperModal
        isOpen={true}
        onClose={mockOnClose}
        itemType="resources"
        onSave={mockOnSave}
        {...props}
      />
    );

  it("has no accessibility violations on the details step", async () => {
    const { container } = renderModal();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

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
    const amountInput = await screen.findByLabelText(/Amount \*/i);
    await user.type(amountInput, "123.45");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(await screen.findByText("$123.45")).toBeInTheDocument();
  });

  it("defaults start date to first of application date month when applicationDate is provided", async () => {
    const user = userEvent.setup();
    renderModal({ applicationDate: "2025-06-15" });

    await user.type(screen.getByLabelText(/Description \*/i), "Test Item");
    await user.click(screen.getByRole("button", { name: /^Next$/i }));

    const startDateInput = await screen.findByLabelText(/Effective From \*/i);
    expect(startDateInput).toHaveValue("2025-06-01");
  });

  it("defaults start date to first of current month when no applicationDate is provided", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-02-15T12:00:00.000Z"));

    try {
      renderModal();

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/Description \*/i), {
          target: { value: "Test Item" },
        });
        fireEvent.click(screen.getByRole("button", { name: /^Next$/i }));
        await vi.runOnlyPendingTimersAsync();
      });

      const startDateInput = screen.getByLabelText(/Effective From \*/i);
      expect(startDateInput).toHaveValue("2025-02-01");
    } finally {
      vi.useRealTimers();
    }
  });
});
