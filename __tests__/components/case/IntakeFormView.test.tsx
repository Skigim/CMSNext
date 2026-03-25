import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBlankIntakeForm } from "@/domain/validation/intake.schema";
import { INTAKE_STEPS } from "@/domain/cases/intake-steps";
import { createMockHouseholdMemberData } from "@/src/test/testUtils";
import { clickToCopy } from "@/utils/clipboard";

expect.extend(toHaveNoViolations);

// ---- Mocks ---------------------------------------------------------------

const mockCategoryConfig = {
  caseTypes: ["Medicaid"],
  caseStatuses: [{ name: "Intake", colorSlot: "blue" }],
  livingArrangements: ["Community"],
  applicationTypes: ["New", "Renewal"],
  groups: [],
  caseCategories: [],
};

vi.mock("@/contexts/CategoryConfigContext", () => ({
  useCategoryConfig: () => ({
    config: mockCategoryConfig,
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

function createDefaultTestHookState() {
  return {
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
}

// Shared state object that tests override per-test via Object.assign
const hookState = createDefaultTestHookState();

vi.mock("@/hooks/useIntakeWorkflow", () => ({
  useIntakeWorkflow: () => hookState,
}));

vi.mock("@/utils/clipboard", () => ({
  clickToCopy: vi.fn().mockResolvedValue(true),
}));

// Import after mocks
import { IntakeFormView } from "@/components/case/IntakeFormView";

// ---- Helpers -------------------------------------------------------------

const HOUSEHOLD_STEP_INDEX = 4;
const REVIEW_STEP_INDEX = INTAKE_STEPS.length - 1;
const HOUSEHOLD_MEMBER_SUMMARY = /Spouse · Jordan Tester · 5559876543/i;
const mockClickToCopy = vi.mocked(clickToCopy);

function createVisitedStepsThrough(stepIndex: number): ReadonlySet<number> {
  return new Set(Array.from({ length: stepIndex + 1 }, (_, index) => index));
}

function createStepState(
  stepIndex: number,
  overrides: Partial<typeof hookState> = {},
) {
  return {
    currentStep: stepIndex,
    visitedSteps: createVisitedStepsThrough(stepIndex),
    ...overrides,
  };
}

function createReviewFormData(overrides: Partial<typeof hookState.formData> = {}) {
  return {
    ...createBlankIntakeForm(),
    firstName: "Alice",
    lastName: "Smith",
    mcn: "12345",
    applicationDate: "2026-01-01",
    ...overrides,
  };
}

/**
 * Creates the shared populated household-member fixture used by the accordion
 * and review-summary tests.
 */
function createPopulatedHouseholdMember() {
  return createMockHouseholdMemberData({
    personId: "person-2",
    firstName: "Jordan",
    lastName: "Tester",
    phone: "5559876543",
  });
}

function createJordanHouseholdFormData() {
  return {
    ...createBlankIntakeForm(),
    householdMembers: [createPopulatedHouseholdMember()],
  };
}

function withHookState(overrides: Partial<typeof hookState>) {
  Object.assign(hookState, overrides);
}

function withReviewStepState(overrides: Partial<typeof hookState> = {}) {
  withHookState(createStepState(REVIEW_STEP_INDEX, {
    canSubmit: true,
    formData: createReviewFormData(),
    ...overrides,
  }));
}

function withHouseholdStepState(overrides: Partial<typeof hookState> = {}) {
  withHookState(createStepState(HOUSEHOLD_STEP_INDEX, overrides));
}

function withJordanHouseholdStepState() {
  withHouseholdStepState({
    formData: createJordanHouseholdFormData(),
  });
}

async function expandJordanHouseholdMember(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: HOUSEHOLD_MEMBER_SUMMARY }));
}

function getNextButton() {
  return screen.getByRole("button", { name: /Next/i });
}

function getSubmitButton() {
  return screen.getByRole("button", { name: /Submit Case/i });
}

function getStepContent() {
  return screen.getByTestId("intake-step-content");
}

function getCancelButton() {
  return screen.queryByRole("button", { name: /Cancel/i });
}

function expectJordanHouseholdFieldsToBeCollapsed() {
  expect(screen.queryByDisplayValue("Jordan")).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue("Tester")).not.toBeInTheDocument();
}

function expectJordanHouseholdFieldsToBeExpanded() {
  expect(screen.getByDisplayValue("Jordan")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Tester")).toBeInTheDocument();
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
    Object.assign(hookState, createDefaultTestHookState());
  });

  // --- Smoke / render -------------------------------------------------------

  describe("render", () => {
    it("displays the first step label", () => {
      // ARRANGE
      renderIntakeFormView();

      // ASSERT
      expect(
        screen.getByRole("heading", {
          name: INTAKE_STEPS[0].label,
          level: 2,
        }),
      ).toBeInTheDocument();
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
      withReviewStepState({
        isEditing: true,
      });

      renderIntakeFormView();

      expect(screen.getByText("Edit Case")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
    });

    it("keeps case-level status options configured for the intake flow", () => {
      expect(mockCategoryConfig.caseStatuses.map((status) => status.name)).toEqual(["Intake"]);
    });
  });

  describe("formatters", () => {
    it("formats stored phone digits for the contact input", () => {
      // ARRANGE
      withHookState(createStepState(1, {
        formData: {
          ...createBlankIntakeForm(),
          phone: "5551234567",
        },
      }));

      // ACT
      renderIntakeFormView();

      // ASSERT
      expect(screen.getByLabelText("Phone")).toHaveValue("(555) 123-4567");
    });

    it("formats stored phone digits on the review step", () => {
      // ARRANGE
      withReviewStepState({
        formData: createReviewFormData({
          phone: "5551234567",
        }),
      });

      // ACT
      renderIntakeFormView();

      // ASSERT
      expect(screen.getByRole("button", { name: "Copy Phone (555) 123-4567" })).toBeInTheDocument();
    });
  });

  describe("review step", () => {
    it("widens the review step layout without widening other steps", () => {
      // ARRANGE
      withReviewStepState();

      // ACT
      const { rerender } = renderIntakeFormView();

      // ASSERT
      expect(screen.getByTestId("intake-step-content").parentElement).toHaveClass(
        "max-w-4xl",
      );

      // ARRANGE
      withHookState(createStepState(0));

      // ACT
      rerender(<IntakeFormView />);

      // ASSERT
      expect(screen.getByTestId("intake-step-content").parentElement).toHaveClass(
        "max-w-2xl",
      );
    });

    it("renders the review cards in a two-column grid", () => {
      // ARRANGE
      withReviewStepState();

      // ACT
      renderIntakeFormView();

      // ASSERT
      expect(screen.getByTestId("intake-review-grid")).toHaveClass(
        "grid",
        "gap-6",
        "md:grid-cols-2",
      );
    });

    it("renders review field values as copy buttons", async () => {
      // ARRANGE
      const user = userEvent.setup();
      withReviewStepState({
        formData: createReviewFormData({
          phone: "5551234567",
          email: "alice@example.com",
        }),
      });

      // ACT
      renderIntakeFormView();
      await user.click(screen.getByRole("button", { name: "Copy First Name Alice" }));

      // ASSERT
      expect(screen.getByRole("button", { name: "Copy Last Name Smith" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Copy Phone (555) 123-4567" })).toBeInTheDocument();
      expect(mockClickToCopy).toHaveBeenCalledWith("Alice", {
        successMessage: "First Name copied to clipboard",
      });
    });

    it("does not show the click-to-copy tooltip on the review step", async () => {
      // ARRANGE
      const user = userEvent.setup();
      withReviewStepState();

      // ACT
      renderIntakeFormView();
      await user.hover(screen.getByRole("button", { name: "Copy First Name Alice" }));

      // ASSERT
      expect(screen.queryByText("Click to copy")).not.toBeInTheDocument();
    });
  });

  describe("Contact step", () => {
    it("renders the applicant Apt field and updates the nested address", async () => {
      // ARRANGE
      withHookState(createStepState(1));

      // ACT
      renderIntakeFormView();
      const aptInput = screen.getByLabelText("Apt");
      fireEvent.change(aptInput, { target: { value: "2B" } });

      // ASSERT
      expect(aptInput).toBeInTheDocument();
      expect(mockUpdateField).toHaveBeenLastCalledWith("address", {
        street: "",
        apt: "2B",
        city: "",
        state: "NE",
        zip: "",
      });
    });

    it("has no accessibility violations on the contact step", async () => {
      // ARRANGE
      withHookState(createStepState(1));

      // ACT
      const { container } = renderIntakeFormView();
      const results = await axe(container);

      // ASSERT
      expect(results).toHaveNoViolations();
    });
  });

  describe("focus management", () => {
    it("focuses the first available field for the active step", async () => {
      // ARRANGE
      withHookState(createStepState(1));

      // ACT
      renderIntakeFormView();

      // ASSERT
      await waitFor(() => {
        expect(screen.getByLabelText("Phone")).toHaveFocus();
      });
    });

    it("moves focus to the next step's first field when the step changes", async () => {
      // ARRANGE
      withHookState(createStepState(1));

      const { rerender } = renderIntakeFormView();

      await waitFor(() => {
        expect(screen.getByLabelText("Phone")).toHaveFocus();
      });

      withHookState(createStepState(2));

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
      withHookState(createStepState(REVIEW_STEP_INDEX, { canSubmit: true }));

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
    it.each([
      {
        name: "renders a Cancel button when onCancel is provided",
        props: { onCancel: vi.fn() },
        shouldRender: true,
      },
      {
        name: "does not render a Cancel button when onCancel is absent",
        props: {},
        shouldRender: false,
      },
    ])("$name", ({ props, shouldRender }) => {
      // ARRANGE
      renderIntakeFormView(props);

      // ASSERT
      if (shouldRender) {
        expect(getCancelButton()).toBeInTheDocument();
      } else {
        expect(getCancelButton()).not.toBeInTheDocument();
      }
    });

    it("calls cancel() from the hook when the Cancel button is clicked", async () => {
      // ARRANGE
      const user = userEvent.setup();
      renderIntakeFormView({ onCancel: vi.fn() });

      // ACT
      await user.click(screen.getByRole("button", { name: /Cancel/i }));

      // ASSERT
      expect(mockCancel).toHaveBeenCalledTimes(1);
    });
  });

  // --- Next / step navigation -----------------------------------------------

  describe("Next button", () => {
    it.each([
      {
        name: "is disabled when isCurrentStepComplete is false",
        overrides: {},
        isDisabled: true,
      },
      {
        name: "is enabled when isCurrentStepComplete is true",
        overrides: { isCurrentStepComplete: true },
        isDisabled: false,
      },
    ])("$name", ({ overrides, isDisabled }) => {
      // ARRANGE
      withHookState(overrides);

      // ACT
      renderIntakeFormView();

      // ASSERT
      if (isDisabled) {
        expect(getNextButton()).toBeDisabled();
      } else {
        expect(getNextButton()).not.toBeDisabled();
      }
    });

    it("calls goNext when clicked", async () => {
      // ARRANGE
      const user = userEvent.setup();
      withHookState({ isCurrentStepComplete: true });
      renderIntakeFormView();

      // ACT
      await user.click(getNextButton());

      // ASSERT
      expect(mockGoNext).toHaveBeenCalledTimes(1);
    });
  });

  describe("keyboard shortcut", () => {
    it("advances to the next step on Ctrl+Enter when the current step is complete", () => {
      // ARRANGE
      withHookState({
        isCurrentStepComplete: true,
      });
      renderIntakeFormView();

      // ACT
      fireEvent.keyDown(getStepContent(), {
        key: "Enter",
        ctrlKey: true,
      });

      // ASSERT
      expect(mockGoNext).toHaveBeenCalledTimes(1);
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it("does not advance to the next step on Ctrl+Enter when the current step is incomplete", () => {
      // ARRANGE
      renderIntakeFormView();

      // ACT
      fireEvent.keyDown(getStepContent(), {
        key: "Enter",
        ctrlKey: true,
      });

      // ASSERT
      expect(mockGoNext).not.toHaveBeenCalled();
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: "Ctrl+Enter",
        keyboardEvent: { key: "Enter", ctrlKey: true },
      },
      {
        name: "Cmd+Enter",
        keyboardEvent: { key: "Enter", metaKey: true },
      },
    ])("submits on the review step with $name when submission is allowed", ({ keyboardEvent }) => {
      // ARRANGE
      mockSubmit.mockResolvedValue(undefined);
      withReviewStepState();
      renderIntakeFormView();

      // ACT
      fireEvent.keyDown(getStepContent(), keyboardEvent);

      // ASSERT
      expect(mockSubmit).toHaveBeenCalledTimes(1);
      expect(mockGoNext).not.toHaveBeenCalled();
    });

    it("does not submit on the review step shortcut while submitting", () => {
      // ARRANGE
      withReviewStepState({
        isSubmitting: true,
      });
      renderIntakeFormView();

      // ACT
      fireEvent.keyDown(getStepContent(), {
        key: "Enter",
        ctrlKey: true,
      });

      // ASSERT
      expect(mockSubmit).not.toHaveBeenCalled();
      expect(mockGoNext).not.toHaveBeenCalled();
    });
  });

  // --- Submit on last step --------------------------------------------------

  describe("Submit button", () => {
    it.each([
      {
        name: "shows 'Submit Case' on the last step",
        overrides: {},
        isDisabled: false,
      },
      {
        name: "is disabled when canSubmit is false on the last step",
        overrides: { canSubmit: false },
        isDisabled: true,
      },
    ])("$name", ({ overrides, isDisabled }) => {
      // ARRANGE
      withReviewStepState(overrides);

      // ACT
      renderIntakeFormView();

      // ASSERT
      expect(getSubmitButton()).toBeInTheDocument();
      if (isDisabled) {
        expect(getSubmitButton()).toBeDisabled();
      } else {
        expect(getSubmitButton()).not.toBeDisabled();
      }
    });

    it("calls submit when clicked", async () => {
      // ARRANGE
      const user = userEvent.setup();
      mockSubmit.mockResolvedValue(undefined);
      withReviewStepState();
      renderIntakeFormView();

      // ACT
      await user.click(getSubmitButton());

      // ASSERT
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });
  });

  // --- Household step -------------------------------------------------------

  describe("Household step", () => {
    it("renders the household members section on step 4", async () => {
      withHouseholdStepState();
      const { container } = renderIntakeFormView();
      const results = await axe(container);
      expect(screen.getByText("Household Members")).toBeInTheDocument();
      expect(results).toHaveNoViolations();
    });

    it("shows existing household members as collapsed accordion summaries", () => {
      // ARRANGE
      withJordanHouseholdStepState();

      // ACT
      renderIntakeFormView();

      // ASSERT
      expect(screen.getByRole("button", { name: HOUSEHOLD_MEMBER_SUMMARY })).toBeInTheDocument();
      expectJordanHouseholdFieldsToBeCollapsed();
    });

    it("formats stored household member roles with the shared role label helper", () => {
      // ARRANGE
      withHouseholdStepState({
        formData: {
          ...createBlankIntakeForm(),
          householdMembers: [
            createMockHouseholdMemberData({
              role: "dependent",
            }),
          ],
        },
      });

      // ACT
      renderIntakeFormView();

      // ASSERT
      expect(screen.getByText("Linked as Dependent")).toBeInTheDocument();
    });

    it.each([
      { name: "shows Child for household_member role", relationshipType: "Child", expectedLabel: "Linked as Child" },
      { name: "shows Spouse for household_member role", relationshipType: "Spouse", expectedLabel: "Linked as Spouse" },
      { name: "falls back to 'Household member' when relationshipType is empty", relationshipType: "", expectedLabel: "Linked as Household member" },
    ])("$name", ({ relationshipType, expectedLabel }) => {
      // ARRANGE
      withHouseholdStepState({
        formData: {
          ...createBlankIntakeForm(),
          householdMembers: [
            createMockHouseholdMemberData({
              role: "household_member",
              relationshipType,
            }),
          ],
        },
      });

      // ACT
      renderIntakeFormView();

      // ASSERT
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    });

    it("expands and collapses a household member accordion entry", async () => {
      // ARRANGE
      const user = userEvent.setup();
      withJordanHouseholdStepState();

      // ACT
      renderIntakeFormView();
      await expandJordanHouseholdMember(user);

      // ASSERT
      expectJordanHouseholdFieldsToBeExpanded();

      // ACT
      await user.click(screen.getByRole("button", { name: /Done/i }));

      // ASSERT
      expectJordanHouseholdFieldsToBeCollapsed();
    });

    it("re-syncs the household accordion after seeded edit data replaces the initial draft state", async () => {
      // ARRANGE
      withHouseholdStepState({
        formData: {
          ...createBlankIntakeForm(),
          householdMembers: [
            createMockHouseholdMemberData({
              relationshipType: "",
              firstName: "",
              lastName: "",
              phone: "",
              email: "",
              dateOfBirth: "",
              ssn: "",
            }),
          ],
        },
      });

      const { rerender } = renderIntakeFormView();

      expect(screen.getByLabelText("Relationship")).toBeInTheDocument();

      // ACT
      withJordanHouseholdStepState();
      rerender(<IntakeFormView onSuccess={vi.fn()} />);

      // ASSERT
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: HOUSEHOLD_MEMBER_SUMMARY }),
        ).toHaveAttribute("aria-expanded", "false");
      });
      expect(screen.queryByLabelText("Relationship")).not.toBeInTheDocument();
      expectJordanHouseholdFieldsToBeCollapsed();
    });

    it("does not render a household status selector", async () => {
      // ARRANGE
      const user = userEvent.setup();
      withJordanHouseholdStepState();

      // ACT
      renderIntakeFormView();
      await expandJordanHouseholdMember(user);

      // ASSERT
      expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    });
  });

  // --- Review step household summary ----------------------------------------

  describe("Review step household summary", () => {
    it("shows 'No household members added' when household members are empty", () => {
      withReviewStepState({
        formData: createReviewFormData({
          relationships: [],
        }),
      });
      renderIntakeFormView();
      expect(screen.getByText("No household members added")).toBeInTheDocument();
    });

    it("shows household member details in the review summary", async () => {
      withReviewStepState({
        formData: createReviewFormData({
          householdMembers: [createPopulatedHouseholdMember()],
        }),
      });
      const { container } = renderIntakeFormView();
      const results = await axe(container);
      expect(
        screen.getByRole("button", { name: "Copy Spouse Jordan Tester" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Copy Contact.*jordan@example.com/i }),
      ).toBeInTheDocument();
      expect(screen.getByText("Date of Birth")).toBeInTheDocument();
      expect(screen.queryByText("DOB / Status")).not.toBeInTheDocument();
      expect(results).toHaveNoViolations();
    });

    it("ignores blank draft household members in the review summary", async () => {
      withReviewStepState({
        formData: createReviewFormData({
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
        }),
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
