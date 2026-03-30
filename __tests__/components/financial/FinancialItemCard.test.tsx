import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockFinancialItem } from "@/src/test/testUtils";
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
    });
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
    });
    const onOpenStepperEdit = vi.fn();

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onOpenStepperEdit={onOpenStepperEdit}
      />
    );

    // ACT - the Card itself is the interactive region (role="button")
    await user.click(screen.getByRole("button", { name: /edit paycheck/i }));

    // ASSERT
    expect(onOpenStepperEdit).toHaveBeenCalledWith(item);
  });

  it("calls onOpenStepperEdit when card is activated with Enter key", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", {
      id: "item-1",
      description: "Paycheck",
      verificationStatus: "Needs VR",
    });
    const onOpenStepperEdit = vi.fn();

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onOpenStepperEdit={onOpenStepperEdit}
      />
    );

    const card = screen.getByRole("button", { name: /edit paycheck/i });
    card.focus();

    // ACT - activate via Enter key
    await user.keyboard("{Enter}");

    // ASSERT
    expect(onOpenStepperEdit).toHaveBeenCalledWith(item);
  });

  it("calls onOpenStepperEdit when card is activated with Space key", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", {
      id: "item-1",
      description: "Paycheck",
      verificationStatus: "Needs VR",
    });
    const onOpenStepperEdit = vi.fn();

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onOpenStepperEdit={onOpenStepperEdit}
      />
    );

    const card = screen.getByRole("button", { name: /edit paycheck/i });
    card.focus();

    // ACT - activate via Space key
    await user.keyboard(" ");

    // ASSERT
    expect(onOpenStepperEdit).toHaveBeenCalledWith(item);
  });

  it("renders correctly with expense item type", () => {
    // ARRANGE
    const item = createMockFinancialItem("expenses", {
      id: "expense-1",
      description: "Rent Payment",
      amount: 1200,
      verificationStatus: "Needs VR",
    });
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
    });
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
    });
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

  it("shows the most recent valid history date instead of relying on array order", () => {
    // ARRANGE
    const item = createMockFinancialItem("income", {
      id: "item-history-date",
      description: "Unearned income",
      amountHistory: [
        {
          id: "entry-older",
          amount: 1000,
          startDate: "2026-03-01",
          endDate: null,
          verificationStatus: "Needs VR",
          createdAt: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "entry-latest",
          amount: 1100,
          startDate: "2026-03-24",
          endDate: null,
          verificationStatus: "Verified",
          createdAt: "2026-03-24T00:00:00.000Z",
        },
      ],
      dateAdded: "2026-02-01T00:00:00.000Z",
    });

    // ACT
    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onOpenStepperEdit={vi.fn()}
      />
    );

    // ASSERT
    expect(screen.getByText("03/24/2026")).toBeInTheDocument();
    expect(screen.queryByText("03/01/2026")).not.toBeInTheDocument();
  });

  it("falls back to item date when history is empty or has only invalid dates", () => {
    // ARRANGE
    const item = createMockFinancialItem("income", {
      id: "item-invalid-history-date",
      description: "Fallback item",
      amountHistory: [
        {
          id: "entry-invalid",
          amount: 900,
          startDate: "",
          endDate: null,
          verificationStatus: "Needs VR",
          createdAt: "2026-03-24T00:00:00.000Z",
        },
      ],
      dateAdded: "2026-02-01T00:00:00.000Z",
    });

    // ACT
    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onOpenStepperEdit={vi.fn()}
      />
    );

    // ASSERT
    expect(screen.getByText("02/01/2026")).toBeInTheDocument();
  });
});
