import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FinancialItemList } from "@/components/financial/FinancialItemList";
import type { FinancialItem } from "@/types/case";
import { createMockFinancialItem } from "@/src/test/testUtils";

// Mock the FinancialItemCard since we just need to test the list behavior
vi.mock("@/components/financial/FinancialItemCard", () => ({
  FinancialItemCard: (props: { item: FinancialItem; onOpenStepperEdit: (item: FinancialItem) => void }) => (
    <div data-testid="financial-item-card">
      <span>{props.item.description}</span>
      <button onClick={() => props.onOpenStepperEdit(props.item)}>Edit</button>
    </div>
  ),
}));

// Mock the stepper modal
vi.mock("@/components/financial/FinancialItemStepperModal", () => ({
  FinancialItemStepperModal: (props: { isOpen: boolean; onClose: () => void; item?: FinancialItem }) => (
    props.isOpen ? (
      <div data-testid="stepper-modal">
        <span>{props.item ? "Edit Mode" : "Add Mode"}</span>
        <button onClick={props.onClose}>Close</button>
      </div>
    ) : null
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FinancialItemList", () => {
  it("renders empty state when no items", () => {
    render(
      <FinancialItemList
        items={[]}
        itemType="resources"
        onDelete={vi.fn()}
        title="Resources"
      />
    );

    expect(screen.getByText("No resources items added yet")).toBeInTheDocument();
  });

  it("renders items when provided", () => {
    const items = [
      createMockFinancialItem("resources", { id: "1", description: "Checking Account" }),
      createMockFinancialItem("resources", { id: "2", description: "Savings Account" }),
    ] as FinancialItem[];

    render(
      <FinancialItemList
        items={items}
        itemType="resources"
        onDelete={vi.fn()}
        title="Resources"
      />
    );

    expect(screen.getByText("Checking Account")).toBeInTheDocument();
    expect(screen.getByText("Savings Account")).toBeInTheDocument();
  });

  it("opens stepper modal in add mode when Add button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <FinancialItemList
        items={[]}
        itemType="resources"
        onDelete={vi.fn()}
        onCreateItem={vi.fn()}
        title="Resources"
      />
    );

    // Click Add button
    const addButton = screen.getByRole("button", { name: /add/i });
    await user.click(addButton);

    // Modal should be open in add mode
    expect(screen.getByTestId("stepper-modal")).toBeInTheDocument();
    expect(screen.getByText("Add Mode")).toBeInTheDocument();
  });

  it("opens stepper modal in edit mode when item edit is triggered", async () => {
    const user = userEvent.setup();
    const items = [
      createMockFinancialItem("resources", { id: "1", description: "Checking Account" }),
    ] as FinancialItem[];

    render(
      <FinancialItemList
        items={items}
        itemType="resources"
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        title="Resources"
      />
    );

    // Click the edit button on the card
    const editButton = screen.getByRole("button", { name: /edit/i });
    await user.click(editButton);

    // Modal should be open in edit mode
    expect(screen.getByTestId("stepper-modal")).toBeInTheDocument();
    expect(screen.getByText("Edit Mode")).toBeInTheDocument();
  });

  it("closes stepper modal when close is triggered", async () => {
    const user = userEvent.setup();

    render(
      <FinancialItemList
        items={[]}
        itemType="resources"
        onDelete={vi.fn()}
        onCreateItem={vi.fn()}
        title="Resources"
      />
    );

    // Open modal
    const addButton = screen.getByRole("button", { name: /add/i });
    await user.click(addButton);

    expect(screen.getByTestId("stepper-modal")).toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByRole("button", { name: /close/i });
    await user.click(closeButton);

    expect(screen.queryByTestId("stepper-modal")).not.toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(
      <FinancialItemList
        items={[]}
        itemType="income"
        onDelete={vi.fn()}
        title="Income Sources"
      />
    );

    expect(screen.getByText("Income Sources")).toBeInTheDocument();
  });
});
