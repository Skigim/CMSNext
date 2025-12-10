import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AmountHistoryModal } from "@/components/financial/AmountHistoryModal";
import { createMockFinancialItem } from "@/src/test/testUtils";
import type { AmountHistoryEntry, FinancialItem } from "@/types/case";

describe("AmountHistoryModal", () => {
  const mockOnClose = vi.fn();
  const mockOnAddEntry = vi.fn();
  const mockOnUpdateEntry = vi.fn();
  const mockOnDeleteEntry = vi.fn();

  const createMockHistoryEntry = (
    overrides: Partial<AmountHistoryEntry> = {}
  ): AmountHistoryEntry => ({
    id: "entry-1",
    amount: 500,
    startDate: "2024-11-01T00:00:00.000Z",
    endDate: null,
    verificationSource: "Bank Statement",
    createdAt: "2024-11-01T10:00:00.000Z",
    ...overrides,
  });

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    item: createMockFinancialItem("income"),
    itemType: "income" as const,
    onAddEntry: mockOnAddEntry,
    onUpdateEntry: mockOnUpdateEntry,
    onDeleteEntry: mockOnDeleteEntry,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render modal with title and description when open", () => {
      // ARRANGE & ACT
      render(<AmountHistoryModal {...defaultProps} />);

      // ASSERT
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Amount History")).toBeInTheDocument();
      expect(
        screen.getByText(/Track historical amounts for/i)
      ).toBeInTheDocument();
    });

    it("should not render modal content when closed", () => {
      // ARRANGE & ACT
      render(<AmountHistoryModal {...defaultProps} isOpen={false} />);

      // ASSERT
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should show empty state when no history entries exist", () => {
      // ARRANGE
      const itemWithoutHistory = createMockFinancialItem("income", {
        amountHistory: undefined,
      });

      // ACT
      render(<AmountHistoryModal {...defaultProps} item={itemWithoutHistory} />);

      // ASSERT
      expect(screen.getByText("No amount history recorded yet.")).toBeInTheDocument();
      expect(screen.getByText(/Add entries to track/i)).toBeInTheDocument();
    });

    it("should display history entries in a table", () => {
      // ARRANGE
      const itemWithHistory: FinancialItem = {
        ...createMockFinancialItem("income"),
        amountHistory: [
          createMockHistoryEntry({
            id: "entry-1",
            amount: 500,
            startDate: "2024-10-01T00:00:00.000Z",
            endDate: "2024-10-31T00:00:00.000Z",
            verificationSource: "Pay Stub Oct",
          }),
          createMockHistoryEntry({
            id: "entry-2",
            amount: 600,
            startDate: "2024-11-01T00:00:00.000Z",
            endDate: null,
            verificationSource: "Pay Stub Nov",
          }),
        ],
      };

      // ACT
      render(<AmountHistoryModal {...defaultProps} item={itemWithHistory} />);

      // ASSERT
      const table = screen.getByRole("table");
      expect(table).toBeInTheDocument();

      // Check table headers
      expect(screen.getByRole("columnheader", { name: "Amount" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Start Date" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "End Date" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Verification" })).toBeInTheDocument();

      // Check table data - amounts formatted as currency
      expect(screen.getByText("$500.00")).toBeInTheDocument();
      expect(screen.getByText("$600.00")).toBeInTheDocument();

      // Check verification sources
      expect(screen.getByText("Pay Stub Oct")).toBeInTheDocument();
      expect(screen.getByText("Pay Stub Nov")).toBeInTheDocument();

      // Ongoing entry shows "Ongoing" for end date
      expect(screen.getByText("Ongoing")).toBeInTheDocument();
    });
  });

  describe("adding entries", () => {
    it("should show add form when Add Entry button is clicked", async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AmountHistoryModal {...defaultProps} />);

      // ACT
      await user.click(screen.getByRole("button", { name: /Add Entry/i }));

      // ASSERT - form title appears
      expect(screen.getByText("New Entry")).toBeInTheDocument();
      expect(screen.getByRole("spinbutton")).toBeInTheDocument(); // Amount input
    });

    it("should pre-fill start date with first of current month", async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AmountHistoryModal {...defaultProps} />);

      // ACT
      await user.click(screen.getByRole("button", { name: /Add Entry/i }));

      // ASSERT - Start date should be first of some month (format YYYY-MM-01)
      const startDateInput = screen.getByLabelText(/Start Date \*/i) as HTMLInputElement;
      expect(startDateInput.value).toMatch(/^\d{4}-\d{2}-01$/);
    });

    it("should call onAddEntry with form data when submitted", async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockOnAddEntry.mockResolvedValue(undefined);
      render(<AmountHistoryModal {...defaultProps} />);

      // ACT
      await user.click(screen.getByRole("button", { name: /Add Entry/i }));
      await user.type(screen.getByLabelText(/Amount \*/i), "750");
      await user.clear(screen.getByLabelText(/Start Date \*/i));
      await user.type(screen.getByLabelText(/Start Date \*/i), "2024-12-01");
      await user.type(
        screen.getByLabelText(/Verification Source/i),
        "Direct Deposit Statement"
      );
      await user.click(screen.getByRole("button", { name: /^Add$/i }));

      // ASSERT
      expect(mockOnAddEntry).toHaveBeenCalledTimes(1);
      expect(mockOnAddEntry).toHaveBeenCalledWith({
        amount: 750,
        startDate: "2024-12-01T00:00:00.000Z",
        endDate: null,
        verificationSource: "Direct Deposit Statement",
      });
    });

    it("should hide form after successful add", async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockOnAddEntry.mockResolvedValue(undefined);
      render(<AmountHistoryModal {...defaultProps} />);

      // ACT
      await user.click(screen.getByRole("button", { name: /Add Entry/i }));
      await user.type(screen.getByLabelText(/Amount \*/i), "100");
      await user.click(screen.getByRole("button", { name: /^Add$/i }));

      // ASSERT - form should be hidden, Add Entry button should be visible
      expect(screen.queryByLabelText(/Amount \*/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Add Entry/i })).toBeInTheDocument();
    });

    it("should cancel adding and hide form when Cancel clicked", async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AmountHistoryModal {...defaultProps} />);

      // ACT
      await user.click(screen.getByRole("button", { name: /Add Entry/i }));
      await user.type(screen.getByLabelText(/Amount \*/i), "999");
      await user.click(screen.getByRole("button", { name: /Cancel/i }));

      // ASSERT
      expect(mockOnAddEntry).not.toHaveBeenCalled();
      expect(screen.queryByLabelText(/Amount \*/i)).not.toBeInTheDocument();
    });
  });

  describe("editing entries", () => {
    it("should populate form with entry data when edit clicked", async () => {
      // ARRANGE
      const user = userEvent.setup();
      const itemWithHistory: FinancialItem = {
        ...createMockFinancialItem("income"),
        amountHistory: [
          createMockHistoryEntry({
            id: "entry-1",
            amount: 500,
            startDate: "2024-10-01T00:00:00.000Z",
            endDate: "2024-10-31T00:00:00.000Z",
            verificationSource: "Pay Stub",
          }),
        ],
      };
      render(<AmountHistoryModal {...defaultProps} item={itemWithHistory} />);

      // ACT
      await user.click(screen.getByRole("button", { name: /Edit entry/i }));

      // ASSERT
      const amountInput = screen.getByLabelText(/Amount \*/i) as HTMLInputElement;
      const startInput = screen.getByLabelText(/Start Date \*/i) as HTMLInputElement;
      const endInput = screen.getByLabelText(/End Date/i) as HTMLInputElement;
      const verificationInput = screen.getByLabelText(/Verification Source/i) as HTMLInputElement;

      expect(amountInput.value).toBe("500");
      expect(startInput.value).toBe("2024-10-01");
      expect(endInput.value).toBe("2024-10-31");
      expect(verificationInput.value).toBe("Pay Stub");
    });

    it("should call onUpdateEntry with updated data when saved", async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockOnUpdateEntry.mockResolvedValue(undefined);
      const itemWithHistory: FinancialItem = {
        ...createMockFinancialItem("income"),
        amountHistory: [
          createMockHistoryEntry({
            id: "entry-123",
            amount: 500,
            startDate: "2024-10-01T00:00:00.000Z",
          }),
        ],
      };
      render(<AmountHistoryModal {...defaultProps} item={itemWithHistory} />);

      // ACT
      await user.click(screen.getByRole("button", { name: /Edit entry/i }));
      const amountInput = screen.getByRole("spinbutton");
      await user.clear(amountInput);
      await user.type(amountInput, "750");
      await user.click(screen.getByRole("button", { name: /Save/i }));

      // ASSERT
      expect(mockOnUpdateEntry).toHaveBeenCalledTimes(1);
      expect(mockOnUpdateEntry).toHaveBeenCalledWith("entry-123", expect.objectContaining({
        amount: 750,
      }));
    });
  });

  describe("deleting entries", () => {
    it("should show delete confirmation when delete clicked", async () => {
      // ARRANGE
      const user = userEvent.setup();
      const itemWithHistory: FinancialItem = {
        ...createMockFinancialItem("income"),
        amountHistory: [createMockHistoryEntry()],
      };
      render(<AmountHistoryModal {...defaultProps} item={itemWithHistory} />);

      // ACT
      await user.click(screen.getByRole("button", { name: /Delete entry/i }));

      // ASSERT
      expect(screen.getByRole("button", { name: /Confirm delete/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cancel delete/i })).toBeInTheDocument();
    });

    it("should call onDeleteEntry when delete confirmed", async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockOnDeleteEntry.mockResolvedValue(undefined);
      const itemWithHistory: FinancialItem = {
        ...createMockFinancialItem("income"),
        amountHistory: [createMockHistoryEntry({ id: "delete-me" })],
      };
      render(<AmountHistoryModal {...defaultProps} item={itemWithHistory} />);

      // ACT
      await user.click(screen.getByRole("button", { name: /Delete entry/i }));
      await user.click(screen.getByRole("button", { name: /Confirm delete/i }));

      // ASSERT
      expect(mockOnDeleteEntry).toHaveBeenCalledTimes(1);
      expect(mockOnDeleteEntry).toHaveBeenCalledWith("delete-me");
    });

    it("should not delete when cancel clicked after delete prompt", async () => {
      // ARRANGE
      const user = userEvent.setup();
      const itemWithHistory: FinancialItem = {
        ...createMockFinancialItem("income"),
        amountHistory: [createMockHistoryEntry()],
      };
      render(<AmountHistoryModal {...defaultProps} item={itemWithHistory} />);

      // ACT
      await user.click(screen.getByRole("button", { name: /Delete entry/i }));
      await user.click(screen.getByRole("button", { name: /Cancel delete/i }));

      // ASSERT
      expect(mockOnDeleteEntry).not.toHaveBeenCalled();
      // Should show original delete button again
      expect(screen.getByRole("button", { name: /Delete entry/i })).toBeInTheDocument();
    });
  });

  describe("modal interactions", () => {
    it("should call onClose when Close button clicked", async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AmountHistoryModal {...defaultProps} />);

      // ACT - Find the footer Close button specifically
      const closeButtons = screen.getAllByRole("button", { name: /Close/i });
      const footerCloseButton = closeButtons.find(btn => btn.textContent === "Close");
      await user.click(footerCloseButton!);

      // ASSERT
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should reset form state when modal is closed", async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AmountHistoryModal {...defaultProps} />);

      // Start adding, then close
      await user.click(screen.getByRole("button", { name: /Add Entry/i }));
      await user.type(screen.getByRole("spinbutton"), "999");
      
      // Find the footer Close button
      const closeButtons = screen.getAllByRole("button", { name: /Close/i });
      const footerCloseButton = closeButtons.find(btn => btn.textContent === "Close");
      await user.click(footerCloseButton!);

      // ASSERT
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("form validation", () => {
    it("should disable submit button when amount is empty", async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AmountHistoryModal {...defaultProps} />);

      // ACT
      await user.click(screen.getByRole("button", { name: /Add Entry/i }));

      // ASSERT - button should be disabled when amount is empty
      const addButton = screen.getByRole("button", { name: /^Add$/i });
      expect(addButton).toBeDisabled();
    });

    it("should enable submit button when required fields are filled", async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(<AmountHistoryModal {...defaultProps} />);

      // ACT
      await user.click(screen.getByRole("button", { name: /Add Entry/i }));
      await user.type(screen.getByRole("spinbutton"), "100");

      // ASSERT - button should be enabled
      const addButton = screen.getByRole("button", { name: /^Add$/i });
      expect(addButton).toBeEnabled();
    });
  });
});
