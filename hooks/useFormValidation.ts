import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { 
  validatePersonData, 
  validateCaseRecordData, 
  validateFinancialItemData, 
  validateNoteData,
  ValidationResult 
} from '../utils/validation';

/**
 * Hook for form validation using Zod schemas
 * Provides real-time validation, error handling, and form state management
 */

interface UseFormValidationReturn<T> {
  // Validation state
  errors: Record<string, string>;
  fieldErrors: Record<string, string[]>;
  isValid: boolean;
  hasErrors: boolean;
  
  // Validation actions
  validate: (data: unknown) => ValidationResult<T>;
  validateField: (field: string, value: unknown) => string | null;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
  setFieldError: (field: string, error: string) => void;
  
  // Form helpers
  getFieldError: (field: string) => string | undefined;
  hasFieldError: (field: string) => boolean;
  
  // Batch validation
  validateMultiple: (data: unknown[]) => boolean;
}

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

// Convenience hooks for specific entity validation
export function usePersonValidation() {
  return useFormValidation(validatePersonData);
}

export function useCaseRecordValidation() {
  return useFormValidation(validateCaseRecordData);
}

export function useFinancialItemValidation() {
  return useFormValidation(validateFinancialItemData);
}

export function useNoteValidation() {
  return useFormValidation(validateNoteData);
}

// Generic hook for any schema
export function useSchemaValidation<T extends z.ZodSchema>(schema: T) {
  const validator = useCallback((data: unknown) => {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return {
        isValid: true,
        data: result.data,
        errors: {},
        fieldErrors: {}
      };
    }

    const errors: Record<string, string> = {};
    const fieldErrors: Record<string, string[]> = {};

    result.error.issues.forEach(issue => {
      const path = issue.path.join('.');
      errors[path] = issue.message;
      
      const field = issue.path[0]?.toString() || 'root';
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(issue.message);
    });

    return {
      isValid: false,
      data: null,
      errors,
      fieldErrors
    };
  }, [schema]);

  return useFormValidation(validator);
}