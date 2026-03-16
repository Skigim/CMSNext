import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBlankIntakeForm } from "@/domain/validation/intake.schema";
import { INTAKE_STEPS } from "@/domain/cases/intake-steps";
import { createMockHouseholdMemberData } from "@/src/test/testUtils";

expect.extend(toHaveNoViolations);

// ---- Mocks ---------------------------------------------------------------

vi.mock("@/contexts/CategoryConfigContext", () => ({
  useCategoryConfig: () => ({
    config: {
      caseTypes: ["Medicaid"],
      caseStatuses: [{ name: "Intake", colorSlot: "blue" }],
      livingArrangements: ["Community"],
      applicationTypes: ["New", "Renewal"],
      groups: [],
      caseCategories: [],
    },
  }),
}));

const mockGoNext = vi.fn();
const mockGoPrev = vi.fn();
const mockGoToStep = vi.fn();
const mockCancel = vi.fn();
const mockSubmit = vi.fn();
const mockUpdateField = vi.fn();
const mockSetFormData = vi.fn();
const mockReset = vi.fn();

// Shared state object that tests override per-test via Object.assign
const hookState = {
  currentStep: 0,
  visitedSteps: new Set([0]) as ReadonlySet<number>,
  formData: createBlankIntakeForm(),
  isEditing: false,
  isSubmitting: false,
  error: null as string | null,
  updateField: mockUpdateField,
  setFormData: mockSetFormData,
  goNext: mockGoNext,
  goPrev: mockGoPrev,
  goToStep: mockGoToStep,
  cancel: mockCancel,
  reset: mockReset,
  submit: mockSubmit,
  isCurrentStepComplete: false,
  canSubmit: false,
};

vi.mock("@/hooks/useIntakeWorkflow", () => ({
  useIntakeWorkflow: () => hookState,
}));

// Import after mocks
import { IntakeFormView } from "@/components/case/IntakeFormView";

// ---- Helpers -------------------------------------------------------------

function withHookState(overrides: Partial<typeof hookState>) {
  Object.assign(hookState, overrides);
}

function renderIntakeFormView(props: { onSuccess?: () => void; onCancel?: () => void } = {}) {
  return render(
    <IntakeFormView
      onSuccess={props.onSuccess ?? vi.fn()}
      onCancel={props.onCancel}
    />,
  );
}

// ---- Tests ---------------------------------------------------------------

describe("IntakeFormView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset hook state to defaults
    Object.assign(hookState, {
      currentStep: 0,
      visitedSteps: new Set([0]) as ReadonlySet<number>,
      formData: createBlankIntakeForm(),
      isEditing: false,
      isSubmitting: false,
      error: null,
      updateField: mockUpdateField,
      setFormData: mockSetFormData,
      goNext: mockGoNext,
      goPrev: mockGoPrev,
      goToStep: mockGoToStep,
      cancel: mockCancel,
      reset: mockReset,
      submit: mockSubmit,
      isCurrentStepComplete: false,
      canSubmit: false,
    });
  });

  // --- Smoke / render -------------------------------------------------------

  describe("render", () => {
    it("displays the first step label", () => {
      renderIntakeFormView();
      expect(screen.getAllByText(INTAKE_STEPS[0].label).length).toBeGreaterThan(0);
    });

    it("shows the step counter in the header", () => {
      renderIntakeFormView();
      expect(screen.getByText(/Step 1 of/)).toBeInTheDocument();
    });

    it("shows all step labels in the sidebar nav", () => {
      renderIntakeFormView();
      for (const step of INTAKE_STEPS) {
        expect(screen.getAllByText(step.label).length).toBeGreaterThan(0);
      }
    });

    it("switches the title and submit affordance in edit mode", () => {
      withHookState({
        isEditing: true,
        currentStep: INTAKE_STEPS.length - 1,
        visitedSteps: new Set(INTAKE_STEPS.map((_, i) => i)),
        canSubmit: true,
      });

      renderIntakeFormView();

      expect(screen.getByText("Edit Case")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
    });
  });

  describe("formatters", () => {
    it("formats stored phone digits for the contact input", () => {
      withHookState({
        currentStep: 1,
        visitedSteps: new Set([0, 1]) as ReadonlySet<number>,
        formData: {
          ...createBlankIntakeForm(),
          phone: "5551234567",
        },
      });

      renderIntakeFormView();

      expect(screen.getByLabelText("Phone")).toHaveValue("(555) 123-4567");
    });

    it("formats stored phone digits on the review step", () => {
      withHookState({
        currentStep: INTAKE_STEPS.length - 1,
        visitedSteps: new Set(INTAKE_STEPS.map((_, i) => i)),
        canSubmit: true,
        formData: {
          ...createBlankIntakeForm(),
          firstName: "Alice",
          lastName: "Smith",
          mcn: "12345",
          applicationDate: "2026-01-01",
          phone: "5551234567",
        },
      });

      renderIntakeFormView();

      expect(screen.getByText("(555) 123-4567")).toBeInTheDocument();
    });
  });

  describe("focus management", () => {
    it("focuses the first available field for the active step", async () => {
      // ARRANGE
      withHookState({
        currentStep: 1,
        visitedSteps: new Set([0, 1]) as ReadonlySet<number>,
      });

      // ACT
      renderIntakeFormView();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByLabelText("Phone")).toHaveFocus();
      });
    });

    it("moves focus to the next step's first field when the step changes", async () => {
      // ARRANGE
      withHookState({
        currentStep: 1,
        visitedSteps: new Set([0, 1]) as ReadonlySet<number>,
      });

      const { rerender } = renderIntakeFormView();

      await waitFor(() => {
        expect(screen.getByLabelText("Phone")).toHaveFocus();
      });

      withHookState({
        currentStep: 2,
        visitedSteps: new Set([0, 1, 2]) as ReadonlySet<number>,
      });

      // ACT
      rerender(
        <IntakeFormView
          onSuccess={vi.fn()}
          onCancel={undefined}
        />,
      );

      // ASSERT
      await waitFor(() => {
        expect(screen.getByLabelText(/MCN/i)).toHaveFocus();
      });
    });

    it("focuses the review step container when no review-field input is available", async () => {
      // ARRANGE
      withHookState({
        currentStep: INTAKE_STEPS.length - 1,
        visitedSteps: new Set(INTAKE_STEPS.map((_, i) => i)),
        canSubmit: true,
      });

      // ACT
      renderIntakeFormView();
      const stepContent = screen.getByTestId("intake-step-content");

      // ASSERT
      await waitFor(() => {
        expect(stepContent).toHaveFocus();
      });
    });
  });

  // --- Cancel wiring --------------------------------------------------------

  describe("cancel wiring", () => {
    it("renders a Cancel button when onCancel is provided", () => {
      renderIntakeFormView({ onCancel: vi.fn() });
      expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    });

    it("does not render a Cancel button when onCancel is absent", () => {
      renderIntakeFormView();
      expect(screen.queryByRole("button", { name: /Cancel/i })).not.toBeInTheDocument();
    });

    it("calls cancel() from the hook when the Cancel button is clicked", async () => {
      const user = userEvent.setup();
      renderIntakeFormView({ onCancel: vi.fn() });
      await user.click(screen.getByRole("button", { name: /Cancel/i }));
      expect(mockCancel).toHaveBeenCalledTimes(1);
    });
  });

  // --- Next / step navigation -----------------------------------------------

  describe("Next button", () => {
    it("is disabled when isCurrentStepComplete is false", () => {
      renderIntakeFormView();
      expect(screen.getByRole("button", { name: /Next/i })).toBeDisabled();
    });

    it("is enabled when isCurrentStepComplete is true", () => {
      withHookState({ isCurrentStepComplete: true });
      renderIntakeFormView();
      expect(screen.getByRole("button", { name: /Next/i })).not.toBeDisabled();
    });

    it("calls goNext when clicked", async () => {
      const user = userEvent.setup();
      withHookState({ isCurrentStepComplete: true });
      renderIntakeFormView();
      await user.click(screen.getByRole("button", { name: /Next/i }));
      expect(mockGoNext).toHaveBeenCalledTimes(1);
    });
  });

  // --- Submit on last step --------------------------------------------------

  describe("Submit button", () => {
    it("shows 'Submit Case' on the last step", () => {
      withHookState({
        currentStep: INTAKE_STEPS.length - 1,
        visitedSteps: new Set(INTAKE_STEPS.map((_, i) => i)),
        canSubmit: true,
      });
      renderIntakeFormView();
      expect(screen.getByRole("button", { name: /Submit Case/i })).toBeInTheDocument();
    });

    it("is disabled when canSubmit is false on the last step", () => {
      withHookState({
        currentStep: INTAKE_STEPS.length - 1,
        visitedSteps: new Set(INTAKE_STEPS.map((_, i) => i)),
        canSubmit: false,
      });
      renderIntakeFormView();
      expect(screen.getByRole("button", { name: /Submit Case/i })).toBeDisabled();
    });

    it("calls submit when clicked", async () => {
      const user = userEvent.setup();
      mockSubmit.mockResolvedValue(undefined);
      withHookState({
        currentStep: INTAKE_STEPS.length - 1,
        visitedSteps: new Set(INTAKE_STEPS.map((_, i) => i)),
        canSubmit: true,
      });
      renderIntakeFormView();
      await user.click(screen.getByRole("button", { name: /Submit Case/i }));
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });
  });

  // --- Household step -------------------------------------------------------

  describe("Household step", () => {
    it("renders the household members section on step 4", async () => {
      withHookState({
        currentStep: 4,
        visitedSteps: new Set([0, 1, 2, 3, 4]) as ReadonlySet<number>,
      });
      const { container } = renderIntakeFormView();
      const results = await axe(container);
      expect(screen.getByText("Household Members")).toBeInTheDocument();
      expect(results).toHaveNoViolations();
    });

    it("shows existing household members as collapsed accordion summaries", () => {
      withHookState({
        currentStep: 4,
        visitedSteps: new Set([0, 1, 2, 3, 4]) as ReadonlySet<number>,
        formData: {
          ...createBlankIntakeForm(),
          householdMembers: [
            createMockHouseholdMemberData({
              personId: "person-2",
              firstName: "Jordan",
              lastName: "Tester",
            }),
          ],
        },
      });
      renderIntakeFormView();
      expect(screen.getByRole("button", { name: /Spouse · Jordan Tester · 5559876543/i })).toBeInTheDocument();
      expect(screen.queryByDisplayValue("Jordan")).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue("Tester")).not.toBeInTheDocument();
    });

    it("expands and collapses a household member accordion entry", async () => {
      const user = userEvent.setup();

      withHookState({
        currentStep: 4,
        visitedSteps: new Set([0, 1, 2, 3, 4]) as ReadonlySet<number>,
        formData: {
          ...createBlankIntakeForm(),
          householdMembers: [
            createMockHouseholdMemberData({
              personId: "person-2",
              firstName: "Jordan",
              lastName: "Tester",
            }),
          ],
        },
      });

      renderIntakeFormView();

      await user.click(screen.getByRole("button", { name: /Spouse · Jordan Tester · 5559876543/i }));
      expect(screen.getByDisplayValue("Jordan")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Tester")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Done/i }));
      expect(screen.queryByDisplayValue("Jordan")).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue("Tester")).not.toBeInTheDocument();
    });

    it("does not render a household status selector", async () => {
      const user = userEvent.setup();

      withHookState({
        currentStep: 4,
        visitedSteps: new Set([0, 1, 2, 3, 4]) as ReadonlySet<number>,
        formData: {
          ...createBlankIntakeForm(),
          householdMembers: [
            createMockHouseholdMemberData({
              personId: "person-2",
              firstName: "Jordan",
              lastName: "Tester",
            }),
          ],
        },
      });

      renderIntakeFormView();

      await user.click(screen.getByRole("button", { name: /Spouse · Jordan Tester · 5559876543/i }));

      expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    });
  });

  // --- Review step household summary ----------------------------------------

  describe("Review step household summary", () => {
    it("shows 'No household members added' when household members are empty", () => {
      withHookState({
        currentStep: INTAKE_STEPS.length - 1,
        visitedSteps: new Set(INTAKE_STEPS.map((_, i) => i)),
        canSubmit: true,
        formData: {
          ...createBlankIntakeForm(),
          firstName: "Alice",
          lastName: "Smith",
          mcn: "12345",
          applicationDate: "2026-01-01",
          relationships: [],
        },
      });
      renderIntakeFormView();
      expect(screen.getByText("No household members added")).toBeInTheDocument();
    });

    it("shows household member details in the review summary", async () => {
      withHookState({
        currentStep: INTAKE_STEPS.length - 1,
        visitedSteps: new Set(INTAKE_STEPS.map((_, i) => i)),
        canSubmit: true,
        formData: {
          ...createBlankIntakeForm(),
          firstName: "Alice",
          lastName: "Smith",
          mcn: "12345",
          applicationDate: "2026-01-01",
          householdMembers: [
            createMockHouseholdMemberData({
              personId: "person-2",
              firstName: "Jordan",
              lastName: "Tester",
            }),
          ],
        },
      });
      const { container } = renderIntakeFormView();
      const results = await axe(container);
      expect(screen.getByText(/Jordan Tester/)).toBeInTheDocument();
      expect(screen.getByText(/jordan@example.com/)).toBeInTheDocument();
      expect(screen.getByText("Date of Birth")).toBeInTheDocument();
      expect(screen.queryByText("DOB / Status")).not.toBeInTheDocument();
      expect(results).toHaveNoViolations();
    });

    it("ignores blank draft household members in the review summary", async () => {
      withHookState({
        currentStep: INTAKE_STEPS.length - 1,
        visitedSteps: new Set(INTAKE_STEPS.map((_, i) => i)),
        canSubmit: true,
        formData: {
          ...createBlankIntakeForm(),
          firstName: "Alice",
          lastName: "Smith",
          mcn: "12345",
          applicationDate: "2026-01-01",
          householdMembers: [
            createMockHouseholdMemberData({
              relationshipType: " ",
              firstName: " ",
              lastName: " ",
              phone: "",
              email: "",
              dateOfBirth: "",
              livingArrangement: "",
            }),
          ],
        },
      });

      const { container } = renderIntakeFormView();
      const results = await axe(container);

      expect(screen.getByText("No household members added")).toBeInTheDocument();
      expect(results).toHaveNoViolations();
    });
  });

  // --- Error display --------------------------------------------------------

  describe("error display", () => {
    it("shows an error message when error is set", () => {
      withHookState({ error: "Something went wrong" });
      renderIntakeFormView();
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  // --- Accessibility --------------------------------------------------------

  describe("accessibility", () => {
    it("has no accessibility violations on step 0", async () => {
      const { container } = renderIntakeFormView();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
