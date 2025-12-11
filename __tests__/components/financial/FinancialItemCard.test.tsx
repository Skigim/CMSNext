import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockFinancialItem } from "@/src/test/testUtils";
import type { FinancialItem } from "@/types/case";
import { FinancialItemCard } from "@/components/financial/FinancialItemCard";
import { toast } from "sonner";

// Mock sonner toast to verify copy success
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

    // ACT
    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
      />
    );

    // ASSERT
    expect(screen.getByText("Monthly Paycheck")).toBeInTheDocument();
    // Amount includes /mo suffix for income
    expect(screen.getByText("$2,500.00/mo")).toBeInTheDocument();
  });

  it("enters edit mode when card is clicked", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", {
      id: "item-1",
      description: "Paycheck",
      verificationStatus: "Needs VR",
    }) as FinancialItem;
    const onUpdate = vi.fn();

    const { container } = render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onUpdate={onUpdate}
      />
    );

    // ACT
    const clickableArea = container.querySelector(".cursor-pointer") as HTMLElement;
    await user.click(clickableArea);

    // ASSERT - form should be visible
    expect(screen.getByRole("textbox", { name: /description/i })).toBeInTheDocument();
  });

  it("saves changes when form is submitted", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", {
      id: "item-1",
      description: "Original Description",
      amount: 100,
      verificationStatus: "Needs VR",
    }) as FinancialItem;
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onUpdate={onUpdate}
        isEditing
      />
    );

    // ACT
    const descriptionInput = screen.getByRole("textbox", { name: /description/i });
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Updated Description");
    await user.click(screen.getByRole("button", { name: /save/i }));

    // ASSERT
    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        "income",
        "item-1",
        expect.objectContaining({ description: "Updated Description" })
      );
    });
  });

  it("cancels edit mode without saving", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", {
      id: "item-1",
      description: "Original",
      verificationStatus: "Needs VR",
    }) as FinancialItem;
    const onUpdate = vi.fn();

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onUpdate={onUpdate}
        isEditing
      />
    );

    // ACT
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    // ASSERT
    expect(onUpdate).not.toHaveBeenCalled();
    // Should return to display mode
    expect(screen.getByText("Original")).toBeInTheDocument();
  });

  it("disables edit when onUpdate is not provided", () => {
    // ARRANGE
    const item = createMockFinancialItem("expenses", {
      id: "exp-1",
      description: "Rent",
    }) as FinancialItem;

    const { container } = render(
      <FinancialItemCard
        item={item}
        itemType="expenses"
        onDelete={vi.fn()}
        // No onUpdate provided
      />
    );

    // ASSERT - card should not be clickable/focusable
    const cardBody = container.querySelector("[role='button']");
    expect(cardBody).toBeNull();
  });

  it("calls onDelete when skeleton card is cancelled", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", {
      id: "fallback-1234",
      description: "",
      amount: 0,
      verificationStatus: "Needs VR",
    }) as FinancialItem;
    const onDelete = vi.fn();

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={onDelete}
        isSkeleton
        isEditing
      />
    );

    // ACT
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    // ASSERT
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("shows floating actions on hover", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const item = createMockFinancialItem("resources", {
      id: "res-1",
      description: "Savings Account",
    }) as FinancialItem;

    render(
      <FinancialItemCard
        item={item}
        itemType="resources"
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    // ACT - hover over card
    const card = screen.getByText("Savings Account").closest(".group");
    expect(card).toBeInTheDocument();
    await user.hover(card!);

    // ASSERT - action buttons should be accessible
    expect(screen.getByRole("button", { name: /edit financial item/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy financial item/i })).toBeInTheDocument();
  });

  it("shows history button when history handlers are provided", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", {
      id: "item-1",
      description: "Paycheck",
    }) as FinancialItem;

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onAddHistoryEntry={vi.fn()}
        onUpdateHistoryEntry={vi.fn()}
        onDeleteHistoryEntry={vi.fn()}
      />
    );

    // ACT
    const card = screen.getByText("Paycheck").closest(".group");
    await user.hover(card!);

    // ASSERT
    expect(screen.getByRole("button", { name: /view amount history/i })).toBeInTheDocument();
  });

  it("triggers copy action when copy button is clicked", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", {
      id: "item-1",
      description: "Salary",
      amount: 3000,
    }) as FinancialItem;

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    // ACT
    const card = screen.getByText("Salary").closest(".group");
    await user.hover(card!);
    await user.click(screen.getByRole("button", { name: /copy financial item/i }));

    // ASSERT - verify toast was called indicating successful copy
    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Financial item copied to clipboard");
    });
  });

  it("does not save on field change, only on submit", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const item = createMockFinancialItem("income", {
      id: "item-1",
      description: "Original",
      amount: 100,
      verificationStatus: "Needs VR",
    }) as FinancialItem;
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        onUpdate={onUpdate}
        isEditing
      />
    );

    // ACT - type in the field but don't submit
    const descriptionInput = screen.getByRole("textbox", { name: /description/i });
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Changed");

    // ASSERT - onUpdate should NOT have been called
    expect(onUpdate).not.toHaveBeenCalled();

    // ACT - now submit
    await user.click(screen.getByRole("button", { name: /save/i }));

    // ASSERT - now it should be called
    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalledTimes(1);
    });
  });

  it("renders skeleton card with dashed border", () => {
    // ARRANGE
    const item = createMockFinancialItem("income", {
      id: "new-item",
      description: "",
    }) as FinancialItem;

    // ACT
    const { container } = render(
      <FinancialItemCard
        item={item}
        itemType="income"
        onDelete={vi.fn()}
        isSkeleton
        isEditing
      />
    );

    // ASSERT
    const card = container.querySelector(".border-dashed");
    expect(card).toBeInTheDocument();
  });
});
