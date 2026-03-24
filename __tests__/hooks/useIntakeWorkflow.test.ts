import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast as mockToast } from "@/src/test/testUtils";
import { createBlankIntakeForm } from "@/domain/validation/intake.schema";
import { INTAKE_STEPS } from "@/domain/cases/intake-steps";
import {
  createMockHouseholdMemberData,
  createMockPerson,
  createMockStoredCase,
} from "@/src/test/testUtils";

// ---- Mocks -----------------------------------------------------------------

vi.mock("@/utils/performanceTracker", () => ({
  startMeasurement: vi.fn(),
  endMeasurement: vi.fn(),
}));

const mockDataManager = {
  createCompleteCase: vi.fn(),
  updateCompleteCase: vi.fn(),
};

vi.mock("@/contexts/DataManagerContext", () => ({
  useDataManagerSafe: () => mockDataManager,
}));

const mockCategoryConfig = {
  caseTypes: ["Medicaid"],
  caseStatuses: [{ name: "Intake", colorSlot: "blue" }],
  livingArrangements: ["Community"],
  groups: [],
  caseCategories: [],
};

vi.mock("@/contexts/CategoryConfigContext", () => ({
  useCategoryConfig: () => ({ config: mockCategoryConfig }),
}));

// Import after mocks
import { useIntakeWorkflow } from "@/hooks/useIntakeWorkflow";

// ---- Helpers ----------------------------------------------------------------

const REVIEW_STEP_INDEX = INTAKE_STEPS.length - 1;

function renderIntakeHook(options: Parameters<typeof useIntakeWorkflow>[0] = {}) {
  return renderHook(() => useIntakeWorkflow(options));
}

/** Fills the four fields required to make the intake form submittable. */
function fillMinimumRequiredFields(result: ReturnType<typeof renderIntakeHook>["result"]) {
  act(() => {
    result.current.updateField("firstName", "Alice");
    result.current.updateField("lastName", "Smith");
    result.current.updateField("mcn", "12345");
    result.current.updateField("applicationDate", "2026-01-01");
  });
}

// ---- Tests ------------------------------------------------------------------

describe("useIntakeWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDataManager.createCompleteCase.mockResolvedValue({
      id: "case-new-1",
      name: "Alice Smith",
      mcn: "12345",
      status: "Intake",
      priority: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockDataManager.updateCompleteCase.mockResolvedValue({
      id: "case-edit-1",
      name: "Alice Smith",
      mcn: "12345",
      status: "Pending",
      priority: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  // --- Initial state --------------------------------------------------------

  describe("initial state", () => {
    it("starts on step 0", () => {
      // Arrange / Act
      const { result } = renderIntakeHook();

      // Assert
      expect(result.current.currentStep).toBe(0);
    });

    it("starts on the summary step when editing a completed intake case", () => {
      // Arrange
      const existingCase = createMockStoredCase({
        caseRecord: {
          ...createMockStoredCase().caseRecord,
          intakeCompleted: true,
        },
      });

      // Act
      const { result } = renderIntakeHook({ existingCase });

      // Assert
      expect(result.current.currentStep).toBe(REVIEW_STEP_INDEX);
    });

    it("starts on step 0 when editing an incomplete intake case", () => {
      // Arrange
      const existingCase = createMockStoredCase({
        caseRecord: {
          ...createMockStoredCase().caseRecord,
          intakeCompleted: false,
        },
      });

      // Act
      const { result } = renderIntakeHook({ existingCase });

      // Assert
      expect(result.current.currentStep).toBe(0);
    });

    it("has step 0 in visited set", () => {
      const { result } = renderIntakeHook();
      expect(result.current.visitedSteps.has(0)).toBe(true);
    });

    it("starts with a blank form", () => {
      const { result } = renderIntakeHook();
      expect(result.current.formData).toEqual(createBlankIntakeForm());
    });

    it("marks every step as visited when editing an existing case", () => {
      // Arrange
      const existingCase = createMockStoredCase();

      // Act
      const { result } = renderIntakeHook({ existingCase });

      // Assert
      expect(result.current.visitedSteps).toEqual(
        new Set(INTAKE_STEPS.map((_, index) => index)),
      );
    });

    it("is not submitting", () => {
      const { result } = renderIntakeHook();
      expect(result.current.isSubmitting).toBe(false);
    });

    it("has no error", () => {
      const { result } = renderIntakeHook();
      expect(result.current.error).toBeNull();
    });

    it("current step is not complete (names are empty)", () => {
      const { result } = renderIntakeHook();
      expect(result.current.isCurrentStepComplete).toBe(false);
    });

    it("canSubmit is false initially", () => {
      const { result } = renderIntakeHook();
      expect(result.current.canSubmit).toBe(false);
    });
  });

  // --- updateField ----------------------------------------------------------

  describe("updateField", () => {
    it("updates a scalar field", () => {
      const { result } = renderIntakeHook();

      act(() => {
        result.current.updateField("firstName", "Alice");
      });

      expect(result.current.formData.firstName).toBe("Alice");
    });

    it("marks step 0 complete after both names are filled", () => {
      const { result } = renderIntakeHook();

      act(() => {
        result.current.updateField("firstName", "Alice");
        result.current.updateField("lastName", "Smith");
      });

      expect(result.current.isCurrentStepComplete).toBe(true);
    });
  });

  // --- setFormData ----------------------------------------------------------

  describe("setFormData", () => {
    it("replaces the entire form data", () => {
      const { result } = renderIntakeHook();
      const newData = {
        ...createBlankIntakeForm(),
        firstName: "Bob",
        lastName: "Jones",
      };

      act(() => {
        result.current.setFormData(newData);
      });

      expect(result.current.formData.firstName).toBe("Bob");
      expect(result.current.formData.lastName).toBe("Jones");
    });
  });

  // --- Navigation -----------------------------------------------------------

  describe("goNext", () => {
    it("advances to step 1", () => {
      const { result } = renderIntakeHook();

      act(() => {
        result.current.goNext();
      });

      expect(result.current.currentStep).toBe(1);
    });

    it("marks the new step as visited", () => {
      const { result } = renderIntakeHook();

      act(() => {
        result.current.goNext();
      });

      expect(result.current.visitedSteps.has(1)).toBe(true);
    });

    it("does not advance past the last step", () => {
      const { result } = renderIntakeHook();

      // Advance to the last step
      act(() => {
        for (let i = 0; i < INTAKE_STEPS.length + 2; i++) {
          result.current.goNext();
        }
      });

      expect(result.current.currentStep).toBe(INTAKE_STEPS.length - 1);
    });

    it("clears error on advance", async () => {
      const { result } = renderIntakeHook();

      act(() => {
        result.current.updateField("firstName", "Alice");
      });

      expect(result.current.canSubmit).toBe(false);

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.goNext();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("goPrev", () => {
    it("goes back one step", () => {
      const { result } = renderIntakeHook();

      act(() => {
        result.current.goNext();
      });
      act(() => {
        result.current.goPrev();
      });

      expect(result.current.currentStep).toBe(0);
    });

    it("does not go below step 0", () => {
      const { result } = renderIntakeHook();

      act(() => {
        result.current.goPrev();
      });

      expect(result.current.currentStep).toBe(0);
    });
  });

  describe("goToStep", () => {
    it("jumps to a previously visited step", () => {
      const { result } = renderIntakeHook();

      act(() => {
        result.current.goNext(); // visits step 1
      });
      act(() => {
        result.current.goToStep(0);
      });

      expect(result.current.currentStep).toBe(0);
    });

    it("does not jump to an unvisited unreachable step", () => {
      const { result } = renderIntakeHook();

      // Step 4 is not visited and form is blank (not reachable)
      act(() => {
        result.current.goToStep(4);
      });

      expect(result.current.currentStep).toBe(0);
    });

    it("allows navigation back to a visited step even when an earlier required field was cleared", () => {
      const { result } = renderIntakeHook();

      // Fill step 0 required fields and advance to step 1 (visits step 1)
      act(() => {
        result.current.updateField("firstName", "Alice");
        result.current.updateField("lastName", "Smith");
      });
      act(() => {
        result.current.goNext(); // now on step 1, step 0 was visited
      });
      act(() => {
        result.current.goNext(); // advance to step 2
      });

      // Go back to step 0 and clear a required field — step 2 is no longer
      // reachable via isStepReachable, but it IS visited.
      act(() => {
        result.current.goToStep(0);
        result.current.updateField("firstName", "");
      });

      // Step 2 should still be navigable since it was previously visited.
      act(() => {
        result.current.goToStep(2);
      });

      expect(result.current.currentStep).toBe(2);
    });

    it("allows full step navigation when editing an existing case", () => {
      // Arrange
      const baseCase = createMockStoredCase();
      const existingCase = createMockStoredCase({
        person: createMockPerson({
          firstName: "",
          lastName: "",
          name: "",
        }),
        caseRecord: {
          ...baseCase.caseRecord,
          mcn: "",
          applicationDate: "",
        },
        mcn: "",
        name: "",
      });
      const { result } = renderIntakeHook({ existingCase });

      // Act
      act(() => {
        result.current.goToStep(INTAKE_STEPS.length - 1);
      });

      // Assert
      expect(result.current.currentStep).toBe(INTAKE_STEPS.length - 1);
    });

    it("ignores out-of-range indices", () => {
      const { result } = renderIntakeHook();

      act(() => {
        result.current.goToStep(99);
      });

      expect(result.current.currentStep).toBe(0);
    });
  });

  // --- cancel ---------------------------------------------------------------

  describe("cancel", () => {
    it("resets state and calls onCancel", () => {
      const onCancel = vi.fn();
      const { result } = renderIntakeHook({ onCancel });

      act(() => {
        result.current.updateField("firstName", "Alice");
        result.current.goNext();
      });

      act(() => {
        result.current.cancel();
      });

      expect(result.current.currentStep).toBe(0);
      expect(result.current.formData.firstName).toBe("");
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("resets state without error when no onCancel provided", () => {
      const { result } = renderIntakeHook();

      act(() => {
        result.current.updateField("firstName", "Alice");
        result.current.goNext();
      });

      act(() => {
        result.current.cancel();
      });

      expect(result.current.currentStep).toBe(0);
      expect(result.current.formData.firstName).toBe("");
    });
  });

  // --- reset ----------------------------------------------------------------

  describe("reset", () => {
    it("resets step to 0 and clears form", () => {
      const { result } = renderIntakeHook();

      act(() => {
        result.current.updateField("firstName", "Alice");
        result.current.goNext();
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.currentStep).toBe(0);
      expect(result.current.formData.firstName).toBe("");
      expect(result.current.visitedSteps.size).toBe(1);
      expect(result.current.visitedSteps.has(0)).toBe(true);
    });

    it("resets edit mode to the latest saved case data after a successful save", async () => {
      // Arrange
      const existingCase = createMockStoredCase({
        id: "case-edit-1",
        name: "Original Applicant",
        mcn: "MCN-ORIGINAL",
        person: createMockPerson({
          id: "person-edit-1",
          firstName: "Original",
          lastName: "Applicant",
          name: "Original Applicant",
          phone: "5551234567",
          ssn: "",
        }),
        caseRecord: {
          ...createMockStoredCase().caseRecord,
          personId: "person-edit-1",
          mcn: "MCN-ORIGINAL",
          applicationDate: "2026-03-01",
        },
      });
      const savedCase = createMockStoredCase({
        id: "case-edit-1",
        name: "Latest Applicant",
        mcn: "MCN-SAVED",
        person: createMockPerson({
          id: "person-edit-1",
          firstName: "Latest",
          lastName: "Applicant",
          name: "Latest Applicant",
          phone: "5551234567",
          ssn: "",
        }),
        caseRecord: {
          ...existingCase.caseRecord,
          mcn: "MCN-SAVED",
          applicationDate: "2026-05-20",
        },
      });
      mockDataManager.updateCompleteCase.mockResolvedValue(savedCase);
      const { result } = renderIntakeHook({ existingCase });

      act(() => {
        result.current.updateField("firstName", "Submitted");
        result.current.updateField("lastName", "Applicant");
        result.current.updateField("mcn", "MCN-SUBMITTED");
        result.current.updateField("applicationDate", "2026-04-15");
      });

      // Act
      await act(async () => {
        await result.current.submit();
      });

      await waitFor(() => {
        expect(result.current.formData.firstName).toBe("Latest");
      });

      act(() => {
        result.current.updateField("firstName", "Unsaved");
        result.current.goNext();
        result.current.reset();
      });

      // Assert
      expect(result.current.currentStep).toBe(REVIEW_STEP_INDEX);
      expect(result.current.formData.firstName).toBe("Latest");
      expect(result.current.formData.lastName).toBe("Applicant");
      expect(result.current.formData.mcn).toBe("MCN-SAVED");
      expect(result.current.formData.applicationDate).toBe("2026-05-20");
      // Edit-mode reset should restore the fully visited "editing an existing
      // case" state, not the create-mode single-step visited set.
      expect(result.current.visitedSteps).toEqual(
        new Set(INTAKE_STEPS.map((_, index) => index)),
      );
    });
  });

  // --- submit ---------------------------------------------------------------

  describe("submit", () => {
    it("calls onSuccess with the created case on success", async () => {
      const onSuccess = vi.fn();
      const { result } = renderIntakeHook({ onSuccess });

      fillMinimumRequiredFields(result);

      await act(async () => {
        await result.current.submit();
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(
          expect.objectContaining({ id: "case-new-1" }),
        );
      });
    });

    it("calls dataManager.createCompleteCase with mapped data", async () => {
      const { result } = renderIntakeHook();

      fillMinimumRequiredFields(result);

      await act(async () => {
        await result.current.submit();
      });

      expect(mockDataManager.createCompleteCase).toHaveBeenCalledWith(
        expect.objectContaining({
          person: expect.objectContaining({
            firstName: "Alice",
            lastName: "Smith",
          }),
          caseRecord: expect.objectContaining({
            mcn: "12345",
            applicationDate: "2026-01-01",
            intakeCompleted: true,
          }),
        }),
      );
      expect(mockDataManager.updateCompleteCase).not.toHaveBeenCalled();
    });

    it("updates an existing case in edit mode while preserving unsupported fields", async () => {
      // Arrange
      const existingCase = createMockStoredCase({
        id: "case-edit-1",
        caseRecord: {
          ...createMockStoredCase().caseRecord,
          personId: "person-edit-1",
          status: "Pending",
          priority: true,
          description: "Keep me",
          retroMonths: ["Jan", "Feb"],
          avsSubmitted: true,
          avsSubmitDate: "2026-01-15",
          interfacesReviewed: true,
          reviewVRs: true,
          reviewPriorBudgets: true,
          reviewPriorNarr: true,
          authorizedReps: ["rep-1"],
        },
        person: createMockPerson({
          id: "person-edit-1",
          phone: "5551234567",
          ssn: "",
          authorizedRepIds: ["rep-1"],
          familyMembers: ["family-1"],
          relationships: [{ type: "Spouse", name: "Jamie Smith", phone: "5550001111" }],
        }),
      });
      const { result } = renderIntakeHook({ existingCase });

      act(() => {
        result.current.updateField("firstName", "Edited");
        result.current.updateField("lastName", "Applicant");
        result.current.updateField("mcn", "MCN-EDITED");
        result.current.updateField("applicationDate", "2026-04-01");
      });

      // Act
      await act(async () => {
        await result.current.submit();
      });

      // Assert
      expect(mockDataManager.updateCompleteCase).toHaveBeenCalledWith(
        "case-edit-1",
        expect.objectContaining({
          person: expect.objectContaining({
            firstName: "Edited",
            lastName: "Applicant",
            authorizedRepIds: ["rep-1"],
            relationships: [{ type: "Spouse", name: "Jamie Smith", phone: "5550001111" }],
          }),
          householdMembers: [],
          caseRecord: expect.objectContaining({
            mcn: "MCN-EDITED",
            applicationDate: "2026-04-01",
            status: "Pending",
            priority: true,
            description: "Keep me",
            retroMonths: ["Jan", "Feb"],
            avsSubmitted: true,
            avsSubmitDate: "2026-01-15",
            interfacesReviewed: true,
            reviewVRs: true,
            reviewPriorBudgets: true,
            reviewPriorNarr: true,
            authorizedReps: ["rep-1"],
            intakeCompleted: true,
          }),
        }),
      );
      const updatePayload = mockDataManager.updateCompleteCase.mock.calls[0]?.[1];
      expect(updatePayload.person).not.toHaveProperty("status");
      expect(updatePayload.householdMembers).toEqual([]);
      expect(mockDataManager.createCompleteCase).not.toHaveBeenCalled();
    });

    it("trims required identity fields before saving", async () => {
      const { result } = renderIntakeHook();

      act(() => {
        result.current.updateField("firstName", "  Alice  ");
        result.current.updateField("lastName", "  Smith  ");
        result.current.updateField("mcn", "  12345  ");
        result.current.updateField("applicationDate", "2026-01-01");
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(mockDataManager.createCompleteCase).toHaveBeenCalledWith(
        expect.objectContaining({
          person: expect.objectContaining({
            firstName: "Alice",
            lastName: "Smith",
          }),
          caseRecord: expect.objectContaining({
            mcn: "12345",
          }),
        }),
      );
    });

    it("maps household members into linked-person save payloads", async () => {
      const { result } = renderIntakeHook();

      act(() => {
        result.current.updateField("firstName", "Alice");
        result.current.updateField("lastName", "Smith");
        result.current.updateField("mcn", "12345");
        result.current.updateField("applicationDate", "2026-01-01");
        result.current.updateField("householdMembers", [
          createMockHouseholdMemberData({
            firstName: "Jamie",
            lastName: "Smith",
            phone: "(555) 123-1111",
            email: "jamie@example.com",
            dateOfBirth: "1987-03-04",
            ssn: "123-45-6789",
            address: {
              street: "123 Main St",
              apt: "",
              city: "Omaha",
              state: "NE",
              zip: "68102",
            },
          }),
          createMockHouseholdMemberData({
            relationshipType: " ",
            firstName: " ",
            lastName: " ",
            phone: "",
            email: "",
            dateOfBirth: "",
            ssn: "",
            livingArrangement: "",
          }),
        ]);
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(mockDataManager.createCompleteCase).toHaveBeenCalledWith(
        expect.objectContaining({
          person: expect.objectContaining({
            relationships: [{ type: "Spouse", name: "Jamie Smith", phone: "5551231111" }],
          }),
          householdMembers: [
            expect.objectContaining({
              relationshipType: "Spouse",
              firstName: "Jamie",
              lastName: "Smith",
              phone: "5551231111",
              email: "jamie@example.com",
              dateOfBirth: "1987-03-04",
              organizationId: null,
            }),
          ],
        }),
      );
      const createPayload = mockDataManager.createCompleteCase.mock.calls[0]?.[0];
      expect(createPayload.person).not.toHaveProperty("status");
      expect(createPayload.householdMembers[0]).not.toHaveProperty("status");
    });

    it("shows an error when canSubmit is false", async () => {
      const { result } = renderIntakeHook();

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.error).not.toBeNull();
      expect(mockDataManager.createCompleteCase).not.toHaveBeenCalled();
    });

    it("shows an error and calls toast.error on dataManager failure", async () => {
      mockDataManager.createCompleteCase.mockRejectedValue(
        new Error("Storage unavailable"),
      );

      const { result } = renderIntakeHook();

      fillMinimumRequiredFields(result);

      await act(async () => {
        await result.current.submit();
      });

      await waitFor(() => {
        expect(result.current.error).toContain("Storage unavailable");
      });
      expect(mockToast.error).toHaveBeenCalled();
    });

    it("blocks submission when optional fields fail intake schema validation", async () => {
      const { result } = renderIntakeHook();

      fillMinimumRequiredFields(result);
      act(() => {
        result.current.updateField("email", "not-an-email");
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.error).toContain("Invalid email address");
      expect(mockDataManager.createCompleteCase).not.toHaveBeenCalled();
    });

    it("normalizes phone numbers before saving the created person", async () => {
      const { result } = renderIntakeHook();

      fillMinimumRequiredFields(result);
      act(() => {
        result.current.updateField("phone", "(555) 123-4567");
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(mockDataManager.createCompleteCase).toHaveBeenCalledWith(
        expect.objectContaining({
          person: expect.objectContaining({
            phone: "5551234567",
          }),
        }),
      );
    });

    it("normalizes date fields before saving the created case", async () => {
      const { result } = renderIntakeHook();

      fillMinimumRequiredFields(result);
      act(() => {
        result.current.updateField("dateOfBirth", "2026-02-03T14:30:00.000Z");
        result.current.updateField("applicationDate", "2026-01-01T10:15:00.000Z");
        result.current.updateField("admissionDate", "2026-01-05T08:45:00.000Z");
        result.current.updateField("avsConsentDate", "2026-01-10T12:00:00.000Z");
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(mockDataManager.createCompleteCase).toHaveBeenCalledWith(
        expect.objectContaining({
          person: expect.objectContaining({
            dateOfBirth: "2026-02-03",
          }),
          caseRecord: expect.objectContaining({
            applicationDate: "2026-01-01",
            admissionDate: "2026-01-05",
            avsConsentDate: "2026-01-10",
          }),
        }),
      );
    });

    it("resets the form on successful submission", async () => {
      const { result } = renderIntakeHook();

      fillMinimumRequiredFields(result);

      await act(async () => {
        await result.current.submit();
      });

      await waitFor(() => {
        expect(result.current.formData.firstName).toBe("");
      });
    });
  });
});
