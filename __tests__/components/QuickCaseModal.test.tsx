import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QuickCaseModal } from "@/components/modals/QuickCaseModal";

// Mock CategoryConfigContext
vi.mock("@/contexts/CategoryConfigContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/CategoryConfigContext")>();
  return {
    ...actual,
    useCategoryConfig: () => ({
      config: {
        caseTypes: ["Type A", "Type B"],
        caseStatuses: [{ name: "Intake", colorSlot: "blue" }],
        livingArrangements: ["Home", "Facility"],
        alertTypes: [],
      },
    }),
  };
});

describe("QuickCaseModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  const renderModal = (isOpen = true) => {
    return render(
      <QuickCaseModal isOpen={isOpen} onClose={mockOnClose} onSave={mockOnSave} />,
    );
  };

  it("renders the modal when open", () => {
    renderModal();
    expect(screen.getByText("New Case")).toBeInTheDocument();
    expect(screen.getByLabelText(/First Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/MCN/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Application Date/)).toBeInTheDocument();
  });

  it("shows add another checkbox", () => {
    renderModal();
    expect(screen.getByLabelText(/Add another case after saving/)).toBeInTheDocument();
  });

  it("calls onClose when cancel is clicked", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: /Cancel/ }));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onSave and onClose when form is submitted without add another", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/First Name/), "John");
    await user.type(screen.getByLabelText(/Last Name/), "Doe");
    await user.type(screen.getByLabelText(/MCN/), "MCN123");

    await user.click(screen.getByRole("button", { name: /Create Case/ }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1);
      // Verify skipNavigation is false when "add another" is not checked
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.any(Object),
        { skipNavigation: false }
      );
    });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("resets form and keeps modal open when add another is checked", async () => {
    const user = userEvent.setup();
    renderModal();

    // Fill out the form
    await user.type(screen.getByLabelText(/First Name/), "John");
    await user.type(screen.getByLabelText(/Last Name/), "Doe");
    await user.type(screen.getByLabelText(/MCN/), "MCN123");

    // Check "add another"
    await user.click(screen.getByLabelText(/Add another case after saving/));

    // Submit the form
    await user.click(screen.getByRole("button", { name: /Create Case/ }));

    // Wait for save to complete
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1);
      // Verify skipNavigation is true when "add another" is checked
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.any(Object),
        { skipNavigation: true }
      );
    });

    // Modal should NOT close (onClose not called)
    expect(mockOnClose).not.toHaveBeenCalled();

    // Form fields should be reset to empty
    await waitFor(() => {
      expect(screen.getByLabelText(/First Name/)).toHaveValue("");
      expect(screen.getByLabelText(/Last Name/)).toHaveValue("");
      expect(screen.getByLabelText(/MCN/)).toHaveValue("");
    });
  });

  it("allows creating multiple cases in succession with add another", async () => {
    const user = userEvent.setup();
    renderModal();

    // Check "add another" first
    await user.click(screen.getByLabelText(/Add another case after saving/));

    // Create first case
    await user.type(screen.getByLabelText(/First Name/), "John");
    await user.type(screen.getByLabelText(/Last Name/), "Doe");
    await user.type(screen.getByLabelText(/MCN/), "MCN123");
    await user.click(screen.getByRole("button", { name: /Create Case/ }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    // Wait for form to reset
    await waitFor(() => {
      expect(screen.getByLabelText(/First Name/)).toHaveValue("");
    });

    // Create second case
    await user.type(screen.getByLabelText(/First Name/), "Jane");
    await user.type(screen.getByLabelText(/Last Name/), "Smith");
    await user.type(screen.getByLabelText(/MCN/), "MCN456");
    await user.click(screen.getByRole("button", { name: /Create Case/ }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(2);
    });

    // Modal still shouldn't have closed
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("resets add another checkbox when modal reopens", async () => {
    const { rerender } = renderModal();

    // Check "add another"
    const checkbox = screen.getByLabelText(/Add another case after saving/);
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // Close and reopen modal
    rerender(
      <QuickCaseModal isOpen={false} onClose={mockOnClose} onSave={mockOnSave} />,
    );
    rerender(
      <QuickCaseModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />,
    );

    // Checkbox should be unchecked
    await waitFor(() => {
      expect(screen.getByLabelText(/Add another case after saving/)).not.toBeChecked();
    });
  });

  it("disables form inputs while saving", async () => {
    // Make onSave take some time
    mockOnSave.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/First Name/), "John");
    await user.type(screen.getByLabelText(/Last Name/), "Doe");
    await user.type(screen.getByLabelText(/MCN/), "MCN123");

    await user.click(screen.getByRole("button", { name: /Create Case/ }));

    // Check that inputs are disabled while saving
    expect(screen.getByLabelText(/First Name/)).toBeDisabled();
    expect(screen.getByLabelText(/Last Name/)).toBeDisabled();
    expect(screen.getByLabelText(/MCN/)).toBeDisabled();
    expect(screen.getByLabelText(/Add another case after saving/)).toBeDisabled();

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });
  });
});
