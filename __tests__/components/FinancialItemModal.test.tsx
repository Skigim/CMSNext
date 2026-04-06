import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import FinancialItemModal from "@/components/modals/FinancialItemModal";
import type { FinancialFormData, FinancialFormErrors } from "@/hooks/useFinancialItemFlow";
import { createMockStoredCase } from "@/src/test/testUtils";

expect.extend(toHaveNoViolations);

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

function createDeferredPromise<T>() {
  let resolvePromise: (value: T) => void;

  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (value: T) => resolvePromise(value),
  };
}

describe("FinancialItemModal", () => {
  it("has no accessibility violations when the dialog is open", async () => {
    // ARRANGE
    const { baseElement } = render(
      <FinancialItemModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
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

    // ACT
    const results = await axe(baseElement);

    // ASSERT
    expect(results).toHaveNoViolations();
  });

  it("keeps save enabled so existing validation can surface errors", () => {
    // ARRANGE / ACT
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

    // ASSERT
    expect(screen.getByRole("button", { name: /save item/i })).toBeEnabled();
  });

  it("submits once with Ctrl+Enter and settles the async save before teardown", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const saveOperation = createDeferredPromise<boolean>();
    const onSave = vi.fn().mockReturnValue(saveOperation.promise);

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

    // ACT
    await user.click(screen.getByLabelText(/item name/i));
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("button", { name: /save item/i })).toBeDisabled();

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      saveOperation.resolve(true);
      await saveOperation.promise;
    });

    // ASSERT
    expect(screen.getByRole("button", { name: /save item/i })).toBeEnabled();
  });
});
