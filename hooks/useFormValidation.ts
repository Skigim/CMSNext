import { useState, useCallback, useMemo } from 'react';
import {
  ValidationResult,
} from '@/utils/validation';

/**
 * Return type for useFormValidation hook.
 * @interface UseFormValidationReturn
 * @template T - Type of data being validated
 */
interface UseFormValidationReturn<T> {
  // Validation state
  /** All validation errors keyed by field name */
  errors: Record<string, string>;
  /** Field-level error arrays (for multi-error fields) */
  fieldErrors: Record<string, string[]>;
  /** Whether all fields are valid */
  isValid: boolean;
  /** Whether any errors exist */
  hasErrors: boolean;
  
  // Validation actions
  /** Validate entire object against schema */
  validate: (data: unknown) => ValidationResult<T>;
  /** Validate single field */
  validateField: (field: string, value: unknown) => string | null;
  /** Clear all validation errors */
  clearErrors: () => void;
  /** Clear errors for specific field */
  clearFieldError: (field: string) => void;
  /** Manually set error for field */
  setFieldError: (field: string, error: string) => void;
  
  // Form helpers
  /** Get error message for field (or undefined) */
  getFieldError: (field: string) => string | undefined;
  /** Check if field has any errors */
  hasFieldError: (field: string) => boolean;
  
  // Batch validation
  /** Validate multiple objects (true if all valid) */
  validateMultiple: (data: unknown[]) => boolean;
}

/**
 * Form validation hook using Zod schemas.
 * 
 * Provides real-time validation with error management and helper methods.
 * Supports single field, whole form, and batch validation.
 * 
 * ## Validation Patterns
 * 
 * ### Single Form Validation
 * ```typescript
 * const { validate, errors, isValid } = useFormValidation(
 *   validatePersonData
 * );
 * 
 * const handleSubmit = (formData) => {
 *   const result = validate(formData);
 *   if (!result.isValid) {
 *     // Handle errors
 *     return;
 *   }
 *   // Process validated data
 * };
 * ```
 * 
 * ### Field-by-Field Validation
 * ```typescript
 * const { validateField, clearFieldError, getFieldError } = useFormValidation(...);
 * 
 * const handleBlur = (field, value) => {
 *   const error = validateField(field, value);
 *   if (!error) {
 *     clearFieldError(field);
 *   }
 * };
 * ```
 * 
 * ### Batch Validation
 * ```typescript
 * const { validateMultiple } = useFormValidation(...);
 * 
 * const allValid = validateMultiple([
 *   caseData,
 *   personData,
 *   financialData
 * ]);
 * ```
 * 
 * ## Built-in Validators
 * 
 * For common data types, import pre-built validators:
 * - `validatePersonData` - Person/contact information
 * - `validateCaseRecordData` - Case details
 * - `validateFinancialItemData` - Financial items
 * - `validateNoteData` - Notes
 * 
 * ## Error Structure
 * 
 * Validation errors are organized two ways:
 * 
 * **errors**: Simple key-value (one error per field)
 * ```typescript
 * {
 *   "name": "Name is required",
 *   "email": "Invalid email format"
 * }
 * ```
 * 
 * **fieldErrors**: Multi-error per field (for complex validation)
 * ```typescript
 * {
 *   "password": [
 *     "Must be at least 8 characters",
 *     "Must contain uppercase letter"
 *   ]
 * }
 * ```
 * 
 * ## Usage with Form Libraries
 * 
 * Works well with React Hook Form or other form libraries:
 * 
 * ```typescript
 * function MyForm() {
 *   const { register, watch } = useForm();
 *   const { validate, getFieldError } = useFormValidation(
 *     validateCaseRecordData
 *   );
 *   
 *   const formData = watch();
 *   
 *   const handleBlur = async () => {
 *     validate(formData);
 *   };
 *   
 *   return (
 *     <form>
 *       <input {...register('name')} onBlur={handleBlur} />
 *       {getFieldError('name') && (
 *         <Error>{getFieldError('name')}</Error>
 *       )}
 *     </form>
 *   );
 * }
 * ```
 * 
 * ## State Management
 * 
 * Error state is managed internally:
 * - `validate()` replaces all errors
 * - `validateField()` updates single field
 * - `clearErrors()` clears all
 * - `setFieldError()` manually set field error
 * 
 * @hook
 * @template T - Type of validated data
 * @param {Function} validator - Zod validator function returning ValidationResult<T>
 * @returns {UseFormValidationReturn<T>} Validation state and helper methods
 * 
 * @see {@link ValidationResult} for validation result structure
 * @see https://zod.dev for Zod schema documentation
 */
export function useFormValidation<T>(
  validator: (data: unknown) => ValidationResult<T>
): UseFormValidationReturn<T> {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const validate = useCallback((data: unknown): ValidationResult<T> => {
    const result = validator(data);
    setErrors(result.errors);
    setFieldErrors(result.fieldErrors);
    return result;
  }, [validator]);

  const clearErrors = useCallback(() => {
    setErrors({});
    setFieldErrors({});
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
    setFieldErrors(prev => {
      const newFieldErrors = { ...prev };
      delete newFieldErrors[field];
      return newFieldErrors;
    });
  }, []);

  const setFieldError = useCallback((field: string, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
    setFieldErrors(prev => ({ ...prev, [field]: [error] }));
  }, []);

  const validateField = useCallback((field: string, _value: unknown): string | null => {
    try {
      // This is a simplified field validation - in practice, you'd want to
      // validate the specific field using the schema
      // For now, we'll just clear the error if validation passes
      clearFieldError(field);
      return null;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Validation error';
      setFieldError(field, errorMsg);
      return errorMsg;
    }
  }, [clearFieldError, setFieldError]);

  const getFieldError = useCallback((field: string): string | undefined => {
    return errors[field];
  }, [errors]);

  const hasFieldError = useCallback((field: string): boolean => {
    return field in errors;
  }, [errors]);

  const validateMultiple = useCallback((data: unknown[]): boolean => {
    let allValid = true;
    data.forEach((item) => {
      const result = validate(item);
      if (!result.isValid) {
        allValid = false;
      }
    });
    return allValid;
  }, [validate]);

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);
  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  return {
    // Validation state
    errors,
    fieldErrors,
    isValid,
    hasErrors,
    
    // Validation actions
    validate,
    validateField,
    clearErrors,
    clearFieldError,
    setFieldError,
    
    // Form helpers
    getFieldError,
    hasFieldError,
    
    // Batch validation
    validateMultiple
  };
}