import { render, screen, within } from "@testing-library/react";
import { act } from "react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";

import type { CaseCategory, FinancialItem } from "@/types/case";
import { createMockFinancialItem } from "@/src/test/testUtils";

const cardPropsSpy = vi.fn();

vi.mock("@/components/financial/FinancialItemCard", () => ({
  FinancialItemCard: (props: {
    item: FinancialItem;
    itemType: CaseCategory;
    onDelete: ((category: CaseCategory, id: string) => void) | (() => void);
    onUpdate?: (category: CaseCategory, id: string, updated: FinancialItem) => void;
    isSkeleton?: boolean;
  }) => {
    cardPropsSpy(props);
    const { item, itemType, onDelete, onUpdate, isSkeleton } = props;

    const handleDelete = () => {
      if (isSkeleton && typeof onDelete === "function" && onDelete.length === 0) {
        (onDelete as () => void)();
      } else if (typeof onDelete === "function") {
        (onDelete as (category: CaseCategory, id: string) => void)(itemType, item.id);
      }
    };

    const handleSave = () => {
      onUpdate?.(itemType, item.id, {
        ...item,
        description: isSkeleton ? "Skeleton saved" : `${item.description} updated`,
        amount: isSkeleton ? 42 : item.amount,
      });
    };

    return (
      <div data-testid={`card-${item.id || "unknown"}`}>
        <span>{item.description || "Skeleton"}</span>
        <button type="button" onClick={handleSave}>
          trigger-save
        </button>
        <button type="button" onClick={handleDelete}>
          trigger-delete
        </button>
      </div>
    );
  },
}));

import { FinancialItemList } from "@/components/financial/FinancialItemList";

afterEach(() => {
  vi.clearAllMocks();
});

describe("FinancialItemList", () => {
  it("renders empty state when no items are present", () => {
    render(
      <FinancialItemList
        items={[]}
        itemType="resources"
        onDelete={vi.fn()}
        title="Resources"
      />
    );

    expect(screen.getByText(/no resources items added yet/i)).toBeInTheDocument();
    expect(cardPropsSpy).not.toHaveBeenCalled();
  });

  it("adds a skeleton card when the add button is pressed", async () => {
    const user = userEvent.setup();

    render(
      <FinancialItemList
        items={[createMockFinancialItem("income", { id: "income-1", description: "Paycheck" }) as FinancialItem]}
        itemType="income"
        onDelete={vi.fn()}
        title="Income"
      />
    );

    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(await screen.findByTestId(/card-skeleton-/i)).toBeInTheDocument();
    expect(cardPropsSpy).toHaveBeenCalled();
  });

  it("saves skeleton cards through the creation handler", async () => {
    const user = userEvent.setup();
    const onCreateItem = vi.fn().mockResolvedValue(undefined);

    render(
      <FinancialItemList
        items={[]}
        itemType="expenses"
        onDelete={vi.fn()}
        onCreateItem={onCreateItem}
        title="Expenses"
      />
    );

    await user.click(screen.getByRole("button", { name: /add/i }));
    const skeletonCard = await screen.findByTestId(/card-skeleton-/i);

    const saveButton = within(skeletonCard).getByRole("button", { name: /trigger-save/i });
    await user.click(saveButton);

    await vi.waitFor(() => {
      expect(onCreateItem).toHaveBeenCalledWith(
        "expenses",
        expect.objectContaining({ description: "Skeleton saved", amount: 42 })
      );
    });

    await vi.waitFor(() => {
      expect(screen.queryByTestId(/card-skeleton-/i)).not.toBeInTheDocument();
    });
  });

  it("registers external skeleton trigger", async () => {
    const user = userEvent.setup();
    const register = vi.fn();

    render(
      <FinancialItemList
        items={[]}
        itemType="resources"
        onDelete={vi.fn()}
        title="Resources"
        onAddSkeleton={register}
      />
    );

    expect(register).toHaveBeenCalledTimes(1);
    const addSkeletonFn = register.mock.calls[0][0] as () => void;

    await act(async () => {
      addSkeletonFn();
    });

    expect(await screen.findByTestId(/card-skeleton-/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /trigger-delete/i }));
    await vi.waitFor(() => {
      expect(screen.queryByTestId(/card-skeleton-/i)).not.toBeInTheDocument();
    });
  });
});
