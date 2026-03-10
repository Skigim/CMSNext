import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBlankIntakeForm } from "@/domain/validation/intake.schema";
import { INTAKE_STEPS } from "@/domain/cases/intake-steps";

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
