import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FinancialItemModal from "@/components/modals/FinancialItemModal";
import type { FinancialFormData, FinancialFormErrors } from "@/hooks/useFinancialItemFlow";
import { createMockStoredCase } from "@/src/test/testUtils";

const baseFormData: FinancialFormData = {
  id: null,
  description: "Checking Account",
  location: "Bank",
  accountNumber: "1234",
  amount: 100,
  frequency: "monthly",
  owner: "applicant",
  verificationStatus: "Needs VR",
  verificationSource: "",
  notes: "",
  dateAdded: "2025-01-01T00:00:00.000Z",
};

const baseFormErrors: FinancialFormErrors = {};

describe("FinancialItemModal", () => {
  it("keeps save enabled so existing validation can surface errors", () => {
    render(
      <FinancialItemModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(false)}
        caseData={createMockStoredCase()}
        itemType="resources"
        isEditing={false}
        formData={{
          ...baseFormData,
          verificationStatus: "Verified",
          verificationSource: "",
        }}
        formErrors={baseFormErrors}
        addAnother={false}
        onFormFieldChange={vi.fn()}
        onAddAnotherChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /save item/i })).toBeEnabled();
  });

  it("submits with Ctrl+Enter when not already submitting", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockImplementation(
      () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 50)),
    );

    render(
      <FinancialItemModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
        caseData={createMockStoredCase()}
        itemType="resources"
        isEditing={false}
        formData={baseFormData}
        formErrors={baseFormErrors}
        addAnother={false}
        onFormFieldChange={vi.fn()}
        onAddAnotherChange={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText(/item name/i));
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });
});
