import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockFinancialItem } from "@/src/test/testUtils";
import type { FinancialItem } from "@/types/case";
import { FinancialItemCard } from "@/components/financial/FinancialItemCard";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  
  // Mock clipboard API properly
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(""),
    },
    configurable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("FinancialItemCard", () => {
  it("renders item details in display mode", () => {
    // ARRANGE
    const item = createMockFinancialItem("income", {
      id: "item-1",
      description: "Monthly Paycheck",
      amount: 2500,
      verificationStatus: "Verified",
    }) as FinancialItem;
    const onOpenStepperEdit = vi.fn();

    // ACT
    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onOpenStepperEdit={onOpenStepperEdit}
      />
    );

    // ASSERT
    expect(screen.getByText("Monthly Paycheck")).toBeInTheDocument();
    // Amount includes /mo suffix for income
    expect(screen.getByText("$2,500.00/mo")).toBeInTheDocument();
  });

  it("calls onOpenStepperEdit when card is clicked", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", {
      id: "item-1",
      description: "Paycheck",
      verificationStatus: "Needs VR",
    }) as FinancialItem;
    const onOpenStepperEdit = vi.fn();

    const { container } = render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onOpenStepperEdit={onOpenStepperEdit}
      />
    );

    // ACT
    const clickableArea = container.querySelector(".cursor-pointer") as HTMLElement;
    await user.click(clickableArea);

    // ASSERT - should call stepper edit handler with item
    expect(onOpenStepperEdit).toHaveBeenCalledWith(item);
  });

  it("renders correctly with expense item type", () => {
    // ARRANGE
    const item = createMockFinancialItem("expenses", {
      id: "expense-1",
      description: "Rent Payment",
      amount: 1200,
      verificationStatus: "Needs VR",
    }) as FinancialItem;
    const onOpenStepperEdit = vi.fn();

    // ACT
    render(
      <FinancialItemCard
        item={item}
        itemType="expenses"
        onDelete={vi.fn()}
        onOpenStepperEdit={onOpenStepperEdit}
      />
    );

    // ASSERT
    expect(screen.getByText("Rent Payment")).toBeInTheDocument();
  });

  it("displays fallback amount from history when available", () => {
    // ARRANGE
    const item = createMockFinancialItem("resources", {
      id: "resource-1",
      description: "Savings Account",
      amount: 0,
      verificationStatus: "Verified",
      amountHistory: [
        {
          id: "entry-1",
          amount: 5000,
          startDate: "2025-01-01",
          endDate: null,
          verificationStatus: "Verified",
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    }) as FinancialItem;
    const onOpenStepperEdit = vi.fn();

    // ACT
    render(
      <FinancialItemCard
        item={item}
        itemType="resources"
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onOpenStepperEdit={onOpenStepperEdit}
      />
    );

    // ASSERT - should show amount from history entry
    expect(screen.getByText("$5,000.00")).toBeInTheDocument();
  });

  it("calls onOpenStepperEdit when edit button is clicked", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", {
      id: "item-1",
      description: "Test Item",
      verificationStatus: "Needs VR",
    }) as FinancialItem;
    const onOpenStepperEdit = vi.fn();
    const onUpdate = vi.fn();

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onUpdate={onUpdate}
        onAddHistoryEntry={vi.fn()}
        onUpdateHistoryEntry={vi.fn()}
        onDeleteHistoryEntry={vi.fn()}
        onOpenStepperEdit={onOpenStepperEdit}
      />
    );

    // ACT - find and click the edit button
    const editButton = screen.getByRole("button", { name: /edit/i });
    await user.click(editButton);

    // ASSERT
    expect(onOpenStepperEdit).toHaveBeenCalledWith(item);
  });

  it("displays verification status badge", () => {
    // ARRANGE
    const item = createMockFinancialItem("income", {
      id: "item-1",
      description: "Test Item",
      verificationStatus: "VR Pending",
      amountHistory: [
        {
          id: "entry-1",
          amount: 1000,
          startDate: "2025-01-01",
          endDate: null,
          verificationStatus: "VR Pending",
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    }) as FinancialItem;
    const onOpenStepperEdit = vi.fn();

    // ACT
    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onOpenStepperEdit={onOpenStepperEdit}
      />
    );

    // ASSERT - should display verification status
    expect(screen.getByText("VR Pending")).toBeInTheDocument();
  });
});
