import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  const goToAmountsStep = async (user: ReturnType<typeof userEvent.setup>, description: string) => {
    await user.type(screen.getByLabelText(/Description \*/i), description);
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    // Wait for the amounts step to be fully rendered before continuing
    await screen.findByLabelText(/Amount \*/i);
  };

  const addAmountEntry = async (user: ReturnType<typeof userEvent.setup>, amount: string) => {
    await user.type(await screen.findByLabelText(/Amount \*/i), amount);
    await user.click(screen.getByRole("button", { name: /^Add$/i }));
  };

  it("has no accessibility violations on the details step", async () => {
    // ARRANGE
    const { container } = renderModal();

    // ACT
    const results = await axe(container);

    // ASSERT
    expect(results).toHaveNoViolations();
  });

  it("has no accessibility violations on the amounts step", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { container } = renderModal({ applicationDate: "2025-06-15" });

    // ACT
    await goToAmountsStep(user, "Test Item");
    const results = await axe(container);

    // ASSERT
    expect(results).toHaveNoViolations();
  });

  it("uses Ctrl+Enter on details step to continue to amount setup", async () => {
    // ARRANGE
    const user = userEvent.setup();
    renderModal();

    // ACT
    const descriptionInput = screen.getByLabelText(/Description \*/i);
    await user.type(descriptionInput, "Checking Account");
    await user.keyboard("{Control>}{Enter}{/Control}");

    // ASSERT
    expect(await screen.findByText(/New Entry/i)).toBeInTheDocument();
  });

  it("uses Ctrl+Enter in amount history setup to add an entry", async () => {
    // ARRANGE
    const user = userEvent.setup();
    renderModal();

    // ACT
    await goToAmountsStep(user, "Savings");
    const amountInput = await screen.findByLabelText(/Amount \*/i);
    await user.type(amountInput, "123.45");
    await user.keyboard("{Control>}{Enter}{/Control}");

    // ASSERT
    expect(await screen.findByText("$123.45")).toBeInTheDocument();
  });

  it("defaults start date to first of application date month when applicationDate is provided", async () => {
    // ARRANGE
    const user = userEvent.setup();
    renderModal({ applicationDate: "2025-06-15" });

    // ACT
    await goToAmountsStep(user, "Test Item");

    // ASSERT
    const startDateInput = await screen.findByLabelText(/Effective From \*/i);
    expect(startDateInput).toHaveValue("2025-06-01");
  });

  it("normalizes blank amount input to zero when saving entry", async () => {
    // ARRANGE
    const user = userEvent.setup();
    renderModal({ applicationDate: "2025-06-15" });

    // ACT
    await goToAmountsStep(user, "Test Item");

    const amountInput = await screen.findByLabelText(/Amount \*/i);
    expect((amountInput as HTMLInputElement).value).toBe("");

    const addEntryButton = screen.getByRole("button", { name: /^Add$/i });
    expect(addEntryButton).toBeEnabled();
    await user.click(addEntryButton);

    expect(await screen.findByText("$0.00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Save Item/i }));

    // ASSERT
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 0,
        amountHistory: [
          expect.objectContaining({
            amount: 0,
            startDate: "2025-06-01",
          }),
        ],
      }),
    );
  });

  it("keeps Add another checked after saving so the next item starts with the toggle preserved", async () => {
    // ARRANGE
    const user = userEvent.setup();
    renderModal({ applicationDate: "2025-06-15" });

    // ACT
    await goToAmountsStep(user, "Test Item");
    await addAmountEntry(user, "123.45");
    await user.click(screen.getByLabelText(/Add another resource/i));
    await user.click(screen.getByRole("button", { name: /Save Item/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledOnce();
    });

    expect(screen.getByLabelText(/Description \*/i)).toHaveValue("");

    await goToAmountsStep(user, "Next Item");

    // ASSERT
    expect(screen.getByLabelText(/Add another resource/i)).toBeChecked();
  });

  it("resets Add another after closing and reopening the modal", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { rerender } = render(
      <FinancialItemStepperModal
        isOpen={true}
        onClose={mockOnClose}
        itemType="resources"
        onSave={mockOnSave}
        applicationDate="2025-06-15"
      />,
    );

    // ACT
    await goToAmountsStep(user, "Test Item");
    await user.click(screen.getByLabelText(/Add another resource/i));
    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(mockOnClose).toHaveBeenCalledOnce();
    await waitFor(() => {
      // The dialog stays mounted until the controlled isOpen prop changes, so the
      // reset state is still observable immediately after requesting close.
      expect(screen.getByLabelText(/Description \*/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Add another resource/i)).not.toBeInTheDocument();
    });

    rerender(
      <FinancialItemStepperModal
        isOpen={false}
        onClose={mockOnClose}
        itemType="resources"
        onSave={mockOnSave}
        applicationDate="2025-06-15"
      />,
    );
    rerender(
      <FinancialItemStepperModal
        isOpen={true}
        onClose={mockOnClose}
        itemType="resources"
        onSave={mockOnSave}
        applicationDate="2025-06-15"
      />,
    );
    await goToAmountsStep(user, "Reopened Item");

    // ASSERT
    expect(screen.getByLabelText(/Add another resource/i)).not.toBeChecked();
  });

  it("defaults start date to first of current month when no applicationDate is provided", async () => {
    // ARRANGE
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-02-15T12:00:00.000Z"));

    try {
      // ACT
      renderModal();

      await act(async () => {
        // fireEvent avoids fake-timer conflicts that userEvent hits in this test scenario.
        fireEvent.change(screen.getByLabelText(/Description \*/i), {
          target: { value: "Test Item" },
        });
        fireEvent.click(screen.getByRole("button", { name: /^Next$/i }));
        await vi.runOnlyPendingTimersAsync();
      });

      // ASSERT
      const startDateInput = screen.getByLabelText(/Effective From \*/i);
      expect(startDateInput).toHaveValue("2025-02-01");
    } finally {
      vi.useRealTimers();
    }
  });
});
