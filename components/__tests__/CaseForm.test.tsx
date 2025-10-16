import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CaseForm } from "@/components/case/CaseForm";
import { createMockCaseDisplay, createMockPerson, createMockCaseRecord } from "@/src/test/testUtils";

describe("CaseForm", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("disables save until required fields are filled and calls onSave with normalized payload", async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<CaseForm onSave={onSave} onCancel={onCancel} />);

    const saveButton = screen.getByRole("button", { name: /create case/i });
    expect(saveButton).toBeDisabled();

    await user.type(screen.getByLabelText(/first name/i), "Alice");
    await user.type(screen.getByLabelText(/last name/i), "Smith");
    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/phone/i), "5551234567");
    await user.type(screen.getByLabelText(/mcn/i), "MCN-1");

    // Application date defaults to today, but ensure the control has a value for clarity
    const applicationDateInput = screen.getByLabelText(/application date/i) as HTMLInputElement;
    expect(applicationDateInput.value).not.toBe("");

    expect(saveButton).not.toBeDisabled();
    await user.click(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];

    expect(payload.person).toMatchObject({
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@example.com",
      phone: "5551234567",
      authorizedRepIds: [],
      familyMembers: [],
    });

    expect(payload.caseRecord).toMatchObject({
      mcn: "MCN-1",
      retroRequested: "",
    });
  });

  it("renders editing state with existing data and calls onCancel when cancelled", async () => {
    const existingCase = createMockCaseDisplay({
      id: "case-123",
      person: createMockPerson({
        firstName: "Existing",
        lastName: "Client",
        email: "existing@example.com",
        phone: "555-111-2222",
      }),
      caseRecord: createMockCaseRecord({
        id: "record-123",
        mcn: "MCN-Existing",
      }),
    });

    const onSave = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<CaseForm case={existingCase} onSave={onSave} onCancel={onCancel} />);

    expect(screen.getByDisplayValue("Existing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("MCN-Existing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("should have proper ARIA labels on form fields", async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(<CaseForm onSave={onSave} onCancel={onCancel} />);

    // Verify that form fields have accessible labels
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mcn/i)).toBeInTheDocument();
  });

  it("should support keyboard navigation", async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<CaseForm onSave={onSave} onCancel={onCancel} />);

    const firstNameInput = screen.getByLabelText(/first name/i);
    
    // Tab to first name field and verify it receives focus
    await user.tab();
    expect(firstNameInput).toHaveFocus();

    // Fill in required fields via keyboard
    await user.type(firstNameInput, "Alice");
    await user.tab();
    await user.type(screen.getByLabelText(/last name/i), "Smith");
    await user.tab();
    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.tab();
    await user.type(screen.getByLabelText(/phone/i), "5551234567");
    await user.tab();
    await user.type(screen.getByLabelText(/mcn/i), "MCN-1");

    // Tab to save button and verify it can be activated
    const saveButton = screen.getByRole("button", { name: /create case/i });
    await user.tab();
    expect(saveButton).toHaveFocus();
  });
});
