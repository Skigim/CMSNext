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
import { dateInputValueToISO, normalizePhoneNumber } from "@/domain/common";
import { useDataManagerSafe } from "../contexts/DataManagerContext";
import { useCategoryConfig } from "../contexts/CategoryConfigContext";
import {
  createCaseRecordData,
  createIntakeFormData,
  createPersonData,
} from "../domain/cases";
import { INTAKE_STEPS, isStepComplete, isStepReachable } from "../domain/cases/intake-steps";
import {
  type IntakeFormData,
  validateIntakeForm,
} from "../domain/validation/intake.schema";
import type { CaseStatus, NewCaseRecordData, NewPersonData, StoredCase } from "../types/case";
import { createLogger } from "../utils/logger";
import { extractErrorMessage } from "../utils/errorUtils";

const logger = createLogger("useIntakeWorkflow");

// ============================================================================
// Types
// ============================================================================

export interface UseIntakeWorkflowOptions {
  /** Existing case to edit; omitted for create mode */
  existingCase?: StoredCase;
  /** Called with the saved case on successful submission */
  onSuccess?: (savedCase: StoredCase) => void;
  /** Called when the user cancels the intake workflow */
  onCancel?: () => void;
}

export interface UseIntakeWorkflowReturn {
  /** Current step index (0-based, matches INTAKE_STEPS) */
  currentStep: number;
  /** Set of step indices the user has previously visited */
  visitedSteps: ReadonlySet<number>;
  /** Live form data draft */
  formData: IntakeFormData;
  /** Whether the workflow is editing an existing case */
  isEditing: boolean;
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
  /**
   * Cancel the intake workflow: resets state to step 0 and calls the
   * onCancel callback provided to the hook (if any).
   */
  cancel: () => void;
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
  existingCase,
  onSuccess,
  onCancel,
}: UseIntakeWorkflowOptions = {}): UseIntakeWorkflowReturn {
  const dataManager = useDataManagerSafe();
  const { config } = useCategoryConfig();
  const isEditing = existingCase !== undefined;
  // Keep the latest saved edit payload as the preservation source so repeated
  // saves in one session do not fall back to stale unsupported field values.
  const [editSourceCase, setEditSourceCase] = useState<StoredCase | undefined>(
    existingCase,
  );
  const activeExistingCase = editSourceCase ?? existingCase;

  // ---- State ----------------------------------------------------------------
  const [currentStep, setCurrentStep] = useState(0);
  const currentStepRef = useRef(currentStep);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(
    () => new Set([0]),
  );
  const [formData, setFormData] = useState<IntakeFormData>(() =>
    createIntakeFormData(activeExistingCase),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeWorkflowState = useCallback(() => {
    currentStepRef.current = 0;
    setCurrentStep(0);
    setVisitedSteps(new Set([0]));
    setEditSourceCase(existingCase);
    setFormData(createIntakeFormData(existingCase));
    setError(null);
    setIsSubmitting(false);
  }, [existingCase]);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    initializeWorkflowState();
  }, [initializeWorkflowState]);

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
      // Allow navigation to any previously-visited step (the sidebar shows those
      // as enabled) even if an earlier required field has since been cleared.
      // Non-visited steps still require every preceding step to be reachable.
      if (!visitedSteps.has(index) && !isStepReachable(index, formData)) return;
      currentStepRef.current = index;
      markVisited(index);
      setCurrentStep(index);
      setError(null);
    },
    [formData, visitedSteps, markVisited],
  );

  // ---- Reset ----------------------------------------------------------------
  const reset = useCallback(() => {
    initializeWorkflowState();
  }, [initializeWorkflowState]);

  // ---- Cancel ---------------------------------------------------------------
  const cancel = useCallback(() => {
    reset();
    onCancel?.();
  }, [reset, onCancel]);

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

    const validationResult = validateIntakeForm(formData);
    if (!validationResult.isValid || !validationResult.data) {
      const msg =
        Object.values(validationResult.errors)[0] ??
        "Please correct the intake form before submitting.";
      setError(msg);
      toast.error(msg);
      return;
    }

    const validatedFormData = validationResult.data;

    setIsSubmitting(true);
    setError(null);

    const toastId = toast.loading(isEditing ? "Saving changes…" : "Creating case…");

    try {
      const trimmedFirstName = validatedFormData.firstName.trim();
      const trimmedLastName = validatedFormData.lastName.trim();
      const trimmedMcn = validatedFormData.mcn.trim();
      const normalizedDateOfBirth = dateInputValueToISO(
        validatedFormData.dateOfBirth,
      );
      const normalizedApplicationDate = dateInputValueToISO(
        validatedFormData.applicationDate,
      );
      const normalizedAdmissionDate = dateInputValueToISO(
        validatedFormData.admissionDate,
      );
      const normalizedAvsConsentDate = dateInputValueToISO(
        validatedFormData.avsConsentDate,
      );
      const defaultLivingArrangement = config.livingArrangements[0] || "";
      const personBase = createPersonData(activeExistingCase, {
        livingArrangement: defaultLivingArrangement,
      });
      const defaultStatus =
        (config.caseStatuses[0]?.name as CaseStatus | undefined) ??
        ("Intake" as CaseStatus);
      const caseRecordBase = createCaseRecordData(activeExistingCase, {
        caseType: config.caseTypes[0],
        caseStatus: activeExistingCase?.caseRecord.status ?? defaultStatus,
        livingArrangement: defaultLivingArrangement,
      });

      const person: NewPersonData = {
        ...personBase,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        dateOfBirth: normalizedDateOfBirth ?? "",
        ssn: validatedFormData.ssn ?? "",
        email: validatedFormData.email ?? "",
        phone: normalizePhoneNumber(validatedFormData.phone ?? ""),
        organizationId: validatedFormData.organizationId ?? null,
        livingArrangement:
          validatedFormData.livingArrangement ||
          personBase.livingArrangement ||
          defaultLivingArrangement,
        address: {
          ...personBase.address,
          street: validatedFormData.address.street ?? "",
          apt: validatedFormData.address.apt ?? undefined,
          city: validatedFormData.address.city ?? "",
          state: validatedFormData.address.state ?? "NE",
          zip: validatedFormData.address.zip ?? "",
        },
        mailingAddress: {
          ...personBase.mailingAddress,
          street: validatedFormData.mailingAddress.street ?? "",
          apt: validatedFormData.mailingAddress.apt ?? undefined,
          city: validatedFormData.mailingAddress.city ?? "",
          state: validatedFormData.mailingAddress.state ?? "NE",
          zip: validatedFormData.mailingAddress.zip ?? "",
          sameAsPhysical: validatedFormData.mailingAddress.sameAsPhysical,
        },
      };

      const caseRecord: NewCaseRecordData = {
        ...caseRecordBase,
        mcn: trimmedMcn,
        applicationDate:
          normalizedApplicationDate ??
          validatedFormData.applicationDate ??
          caseRecordBase.applicationDate,
        caseType:
          validatedFormData.caseType || caseRecordBase.caseType || config.caseTypes[0] || "",
        applicationType:
          validatedFormData.applicationType ?? caseRecordBase.applicationType ?? "",
        personId: caseRecordBase.personId,
        status: caseRecordBase.status || defaultStatus,
        livingArrangement:
          validatedFormData.livingArrangement ||
          caseRecordBase.livingArrangement ||
          defaultLivingArrangement,
        withWaiver: validatedFormData.withWaiver ?? false,
        admissionDate: normalizedAdmissionDate ?? caseRecordBase.admissionDate ?? "",
        organizationId:
          validatedFormData.organizationId ?? caseRecordBase.organizationId ?? "",
        retroRequested:
          validatedFormData.retroRequested ?? caseRecordBase.retroRequested ?? "",
        appValidated: validatedFormData.appValidated ?? false,
        agedDisabledVerified: validatedFormData.agedDisabledVerified ?? false,
        citizenshipVerified: validatedFormData.citizenshipVerified ?? false,
        residencyVerified: validatedFormData.residencyVerified ?? false,
        contactMethods: (validatedFormData.contactMethods ?? []) as NonNullable<
          NewCaseRecordData["contactMethods"]
        >,
        voterFormStatus: (validatedFormData.voterFormStatus ?? "") as NonNullable<
          NewCaseRecordData["voterFormStatus"]
        >,
        pregnancy: validatedFormData.pregnancy ?? false,
        avsConsentDate: normalizedAvsConsentDate ?? caseRecordBase.avsConsentDate ?? "",
        maritalStatus: validatedFormData.maritalStatus ?? "",
      };

      const savedCase = isEditing && activeExistingCase
        ? await dataManager.updateCompleteCase(activeExistingCase.id, {
            person,
            caseRecord,
          })
        : await dataManager.createCompleteCase({
            person,
            caseRecord,
          });

      logger.info(`Intake case ${isEditing ? "updated" : "created"}`, {
        caseId: savedCase.id,
      });
      toast.success(
        isEditing ? "Case updated successfully!" : "Case created successfully!",
        { id: toastId },
      );

      if (isEditing) {
        setEditSourceCase(savedCase);
        setFormData(createIntakeFormData(savedCase));
      } else {
        reset();
      }
      onSuccess?.(savedCase);
    } catch (caughtError) {
      const msg = extractErrorMessage(caughtError);
      logger.error("Intake submission failed", { error: msg });
      setError(msg);
      toast.error(
        `Failed to ${isEditing ? "save changes" : "create case"}: ${msg}`,
        { id: toastId },
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeExistingCase,
    dataManager,
    canSubmit,
    formData,
    config,
    isEditing,
    reset,
    onSuccess,
  ]);

  return {
    currentStep,
    visitedSteps,
    formData,
    isEditing,
    isSubmitting,
    error,
    updateField,
    setFormData,
    goNext,
    goPrev,
    goToStep,
    reset,
    cancel,
    submit,
    isCurrentStepComplete,
    canSubmit,
  };
}
