import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CaseForm } from "@/components/case/CaseForm";
import { mergeCategoryConfig } from "@/types/categoryConfig";

const categoryConfigMock = mergeCategoryConfig({
  caseTypes: ["MLTC", "LTSS"],
  caseStatuses: ["Pending", "Active", "Closed"],
  livingArrangements: ["Community", "Nursing Home"],
});

vi.mock("@/contexts/CategoryConfigContext", () => ({
  useCategoryConfig: () => ({
    config: categoryConfigMock,
    loading: false,
    error: null,
    refresh: vi.fn(),
    updateCategory: vi.fn(),
    resetToDefaults: vi.fn(),
    setConfigFromFile: vi.fn(),
  }),
}));

describe("CaseForm", () => {
  it("allows form submission with optional email and phone fields empty", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(<CaseForm onSave={onSave} onCancel={onCancel} />);

    // Fill required fields only (person tab is active by default)
    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);

    await user.type(firstNameInput, "John");
    await user.type(lastNameInput, "Doe");
    
    // Switch to case tab to fill MCN
    const caseTab = screen.getByRole("tab", { name: /case details/i });
    await user.click(caseTab);
    
    // Now find and fill the MCN input
    const mcnInput = screen.getByLabelText(/mcn/i);
    await user.clear(mcnInput);
    await user.type(mcnInput, "MCN12345");

    // Submit button should be enabled without email and phone
    const submitButton = screen.getByRole("button", { name: /create case/i });
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    // Verify onSave was called with data where email and phone can be empty
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        person: expect.objectContaining({
          firstName: "John",
          lastName: "Doe",
          email: "", // Empty email should be accepted
          phone: "", // Empty phone should be accepted
        }),
        caseRecord: expect.objectContaining({
          mcn: "MCN12345",
        }),
      })
    );
  });

  it("disables submit button when required fields are missing", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(<CaseForm onSave={onSave} onCancel={onCancel} />);

    const submitButton = screen.getByRole("button", { name: /create case/i });
    
    // Submit button should be disabled when required fields are empty
    expect(submitButton).toBeDisabled();

    // Fill only first name
    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.type(firstNameInput, "John");

    // Still disabled because last name and MCN are missing
    expect(submitButton).toBeDisabled();
  });

  it("allows form submission with email and phone filled", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(<CaseForm onSave={onSave} onCancel={onCancel} />);

    // Fill all fields including optional ones
    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const phoneInput = screen.getByLabelText(/phone/i);

    await user.type(firstNameInput, "Jane");
    await user.type(lastNameInput, "Smith");
    await user.type(emailInput, "jane@example.com");
    await user.type(phoneInput, "555-1234");

    // Switch to case tab
    const caseTab = screen.getByRole("tab", { name: /case details/i });
    await user.click(caseTab);

    const mcnInput = screen.getByLabelText(/mcn/i);
    await user.clear(mcnInput);
    await user.type(mcnInput, "MCN67890");

    const submitButton = screen.getByRole("button", { name: /create case/i });
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    // Verify onSave was called with all data
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        person: expect.objectContaining({
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@example.com",
          phone: "555-1234",
        }),
        caseRecord: expect.objectContaining({
          mcn: "MCN67890",
        }),
      })
    );
  });
});
