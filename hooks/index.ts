/**
 * Barrel exports for custom hooks
 * Provides clean import paths for all application-specific hooks
 */

// Case management operations
export { useCaseManagement } from './useCaseManagement';

// File system connection flow
export { useConnectionFlow } from './useConnectionFlow';

// Navigation flow
export { useNavigationFlow } from './useNavigationFlow';

// Financial item flow
export { useFinancialItemFlow } from './useFinancialItemFlow';

// Note flow
export { useNoteFlow } from './useNoteFlow';

// Note management operations  
export { useNotes } from './useNotes';

// Financial item management
export { useFinancialItems } from './useFinancialItems';

// Global application state
export { useAppState } from './useAppState';

// Form validation hooks
export { 
  useFormValidation,
  usePersonValidation,
  useCaseRecordValidation,
  useFinancialItemValidation,
  useNoteValidation,
  useSchemaValidation
} from './useFormValidation';

/**
 * Usage examples:
 * 
 * // Instead of:
 * import { useCaseManagement } from '../hooks/useCaseManagement';
 * import { useNotes } from '../hooks/useNotes';
 * import { useFinancialItems } from '../hooks/useFinancialItems';
 * 
 * // Use:
 * import { useCaseManagement, useNotes, useFinancialItems } from '../hooks';
 */