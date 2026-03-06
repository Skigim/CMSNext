/**
 * useIntakeWorkflow – step-based Medicaid intake form orchestration.
 *
 * Manages:
 * - Current step index and visited-step tracking
 * - Form data state (unified IntakeFormData draft)
 * - Step navigation (next/prev/jump-to)
 * - Final submission via DataManager
 *
 * @module hooks/useIntakeWorkflow
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import { useDataManagerSafe } from "../contexts/DataManagerContext";
import { useCategoryConfig } from "../contexts/CategoryConfigContext";
import { INTAKE_STEPS, isStepComplete, isStepReachable } from "../domain/cases/intake-steps";
import {
  createBlankIntakeForm,
  type IntakeFormData,
} from "../domain/validation/intake.schema";
import type { CaseStatus, NewCaseRecordData, NewPersonData, StoredCase } from "../types/case";
import { createLogger } from "../utils/logger";
import { extractErrorMessage } from "../utils/errorUtils";

const logger = createLogger("useIntakeWorkflow");

// ============================================================================
// Types
// ============================================================================

export interface UseIntakeWorkflowOptions {
  /** Called with the newly-created case on successful submission */
  onSuccess?: (createdCase: StoredCase) => void;
  /** Called when the user cancels the intake workflow */
  onCancel?: () => void;
}

export interface UseIntakeWorkflowReturn {
  /** Current step index (0-based, matches INTAKE_STEPS) */
  currentStep: number;
  /** Set of step indices the user has previously visited */
  visitedSteps: Set<number>;
  /** Live form data draft */
  formData: IntakeFormData;
  /** Whether a submission is in progress */
  isSubmitting: boolean;
  /** Most recent error message, or null */
  error: string | null;
  /** Update one or more fields in the form draft */
  updateField: <K extends keyof IntakeFormData>(
    field: K,
    value: IntakeFormData[K],
  ) => void;
  /** Replace entire form data (e.g. when prefilling from an existing draft) */
  setFormData: Dispatch<SetStateAction<IntakeFormData>>;
  /** Navigate to the next step (no-op if already on last step) */
  goNext: () => void;
  /** Navigate to the previous step (no-op if on step 0) */
  goPrev: () => void;
  /** Jump directly to a specific step (only if reachable) */
  goToStep: (index: number) => void;
  /** Reset the entire workflow back to step 0 with a blank form */
  reset: () => void;
  /** Submit the completed intake form */
  submit: () => Promise<void>;
  /** Whether the current step passes completion criteria */
  isCurrentStepComplete: boolean;
  /** Whether the review step (last step) can be reached */
  canSubmit: boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing the step-based intake workflow.
 *
 * Delegates all persistence to DataManager.  Components should never call
 * DataManager directly – they get their operations through this hook.
 *
 * @example
 * ```tsx
 * function IntakeFormView() {
 *   const { formData, currentStep, goNext, goPrev, submit } = useIntakeWorkflow({
 *     onSuccess: (c) => navigate(`/cases/${c.id}`),
 *     onCancel: () => navigate('/dashboard'),
 *   });
 *   // …
 * }
 * ```
 */
export function useIntakeWorkflow({
  onSuccess,
}: UseIntakeWorkflowOptions = {}): UseIntakeWorkflowReturn {
  const dataManager = useDataManagerSafe();
  const { config } = useCategoryConfig();

  // ---- State ----------------------------------------------------------------
  const [currentStep, setCurrentStep] = useState(0);
  const currentStepRef = useRef(currentStep);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(
    () => new Set([0]),
  );
  const [formData, setFormData] = useState<IntakeFormData>(() =>
    createBlankIntakeForm(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // ---- Derived values -------------------------------------------------------
  const isCurrentStepComplete = useMemo(
    () => isStepComplete(currentStep, formData),
    [currentStep, formData],
  );

  const canSubmit = useMemo(
    () => isStepComplete(INTAKE_STEPS.length - 1, formData),
    [formData],
  );

  // ---- Field update ---------------------------------------------------------
  const updateField = useCallback(
    <K extends keyof IntakeFormData>(field: K, value: IntakeFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // ---- Navigation -----------------------------------------------------------
  const markVisited = useCallback((index: number) => {
    setVisitedSteps((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const goNext = useCallback(() => {
    const next = Math.min(
      currentStepRef.current + 1,
      INTAKE_STEPS.length - 1,
    );
    currentStepRef.current = next;
    setCurrentStep(next);
    markVisited(next);
    setError(null);
  }, [markVisited]);

  const goPrev = useCallback(() => {
    const next = Math.max(currentStepRef.current - 1, 0);
    currentStepRef.current = next;
    setCurrentStep(next);
    setError(null);
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= INTAKE_STEPS.length) return;
      if (!isStepReachable(index, formData)) return;
      currentStepRef.current = index;
      markVisited(index);
      setCurrentStep(index);
      setError(null);
    },
    [formData, markVisited],
  );

  // ---- Reset ----------------------------------------------------------------
  const reset = useCallback(() => {
    currentStepRef.current = 0;
    setCurrentStep(0);
    setVisitedSteps(new Set([0]));
    setFormData(createBlankIntakeForm());
    setError(null);
    setIsSubmitting(false);
  }, []);

  // ---- Submit ---------------------------------------------------------------
  const submit = useCallback(async () => {
    if (!dataManager) {
      const msg =
        "Data storage is not available. Please connect to a folder first.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!canSubmit) {
      const msg =
        "Please complete all required fields before submitting.";
      setError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const toastId = toast.loading("Creating case…");

    try {
      // Build NewPersonData from form draft
      const person: NewPersonData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth ?? "",
        ssn: formData.ssn ?? "",
        email: formData.email ?? "",
        phone: formData.phone ?? "",
        organizationId: formData.organizationId ?? null,
        livingArrangement:
          formData.livingArrangement || config.livingArrangements[0] || "",
        address: {
          street: formData.address.street ?? "",
          apt: formData.address.apt,
          city: formData.address.city ?? "",
          state: formData.address.state ?? "NE",
          zip: formData.address.zip ?? "",
        },
        mailingAddress: {
          street: formData.mailingAddress.street ?? "",
          apt: formData.mailingAddress.apt,
          city: formData.mailingAddress.city ?? "",
          state: formData.mailingAddress.state ?? "NE",
          zip: formData.mailingAddress.zip ?? "",
          sameAsPhysical: formData.mailingAddress.sameAsPhysical,
        },
        authorizedRepIds: [],
        familyMembers: [],
        relationships: [],
        status: "Active",
      };

      // Derive a default status from config if available
      const defaultStatus =
        (config.caseStatuses[0]?.name as CaseStatus | undefined) ??
        ("Intake" as CaseStatus);

      // Build NewCaseRecordData from form draft
      const caseRecord: NewCaseRecordData = {
        mcn: formData.mcn,
        applicationDate: formData.applicationDate,
        caseType: formData.caseType || config.caseTypes[0] || "",
        applicationType: formData.applicationType ?? "",
        personId: "", // assigned by DataManager after person creation
        status: defaultStatus,
        description: "",
        priority: false,
        livingArrangement:
          formData.livingArrangement || config.livingArrangements[0] || "",
        withWaiver: formData.withWaiver ?? false,
        admissionDate: formData.admissionDate ?? "",
        organizationId: formData.organizationId ?? "",
        authorizedReps: [],
        retroRequested: formData.retroRequested ?? "",
        // Intake checklist fields
        appValidated: formData.appValidated ?? false,
        agedDisabledVerified: formData.agedDisabledVerified ?? false,
        citizenshipVerified: formData.citizenshipVerified ?? false,
        residencyVerified: formData.residencyVerified ?? false,
        contactMethods: (formData.contactMethods ?? []) as NonNullable<
          NewCaseRecordData["contactMethods"]
        >,
        voterFormStatus: (formData.voterFormStatus ?? "") as NonNullable<
          NewCaseRecordData["voterFormStatus"]
        >,
        pregnancy: formData.pregnancy ?? false,
        avsConsentDate: formData.avsConsentDate ?? "",
        maritalStatus: formData.maritalStatus ?? "",
      };

      const createdCase = await dataManager.createCompleteCase({
        person,
        caseRecord,
      });

      logger.info("Intake case created", { caseId: createdCase.id });
      toast.success("Case created successfully!", { id: toastId });

      reset();
      onSuccess?.(createdCase);
    } catch (caughtError) {
      const msg = extractErrorMessage(caughtError);
      logger.error("Intake submission failed", { error: msg });
      setError(msg);
      toast.error(`Failed to create case: ${msg}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    dataManager,
    canSubmit,
    formData,
    config,
    reset,
    onSuccess,
  ]);

  // ---- Cancel ---------------------------------------------------------------
  // onCancel is called directly by the component (passed in via options) – the hook
  // exposes `reset()` separately so the component can reset state without navigating.
  // The cancel action itself is wired in IntakeFormView.

  return {
    currentStep,
    visitedSteps,
    formData,
    isSubmitting,
    error,
    updateField,
    setFormData,
    goNext,
    goPrev,
    goToStep,
    reset,
    submit,
    isCurrentStepComplete,
    canSubmit,
  };
}
