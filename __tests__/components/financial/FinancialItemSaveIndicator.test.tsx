import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, it, expect } from "vitest";

import { FinancialItemSaveIndicator } from "@/components/financial/FinancialItemSaveIndicator";

describe("FinancialItemSaveIndicator", () => {
  it("renders nothing when idle", () => {
    // ARRANGE
    const { container } = render(<FinancialItemSaveIndicator isSaving={false} saveSuccessVisible={false} />);

    // ASSERT
    expect(container.firstChild).toBeNull();
  });

  it("shows saving spinner when saving", () => {
    // ARRANGE
    render(<FinancialItemSaveIndicator isSaving saveSuccessVisible={false} />);

    // ASSERT
    expect(screen.getByText("Saving")).toBeInTheDocument();
  });

  it("shows success state when finished", () => {
    // ARRANGE
    render(<FinancialItemSaveIndicator isSaving={false} saveSuccessVisible />);

    // ASSERT
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("has no accessibility violations for the saving state", async () => {
    // ARRANGE
    const { container } = render(
      <FinancialItemSaveIndicator isSaving saveSuccessVisible={false} />,
    );

    // ACT
    const results = await axe(container);

    // ASSERT
    expect(results).toHaveNoViolations();
  });
});
