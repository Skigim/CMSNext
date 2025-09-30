import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { FinancialItemSaveIndicator } from "@/components/financial/FinancialItemSaveIndicator";

describe("FinancialItemSaveIndicator", () => {
  it("renders nothing when idle", () => {
    const { container } = render(<FinancialItemSaveIndicator isSaving={false} saveSuccessVisible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows saving spinner when saving", () => {
    render(<FinancialItemSaveIndicator isSaving saveSuccessVisible={false} />);
    expect(screen.getByLabelText(/saving/i)).toBeInTheDocument();
  });

  it("shows success state when finished", () => {
    render(<FinancialItemSaveIndicator isSaving={false} saveSuccessVisible />);
    expect(screen.getByLabelText(/saved/i)).toBeInTheDocument();
  });
});
