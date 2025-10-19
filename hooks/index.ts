/**
 * Barrel exports for custom hooks
 * Provides clean import paths for all application-specific hooks
 */

// Case management operations
export { useCaseManagement } from './useCaseManagement';

// Case activity log
export { useCaseActivityLog } from './useCaseActivityLog';

// File system connection flow
export { useConnectionFlow } from './useConnectionFlow';

// Autosave status helpers
export { useAutosaveStatus } from './useAutosaveStatus';

// Navigation flow
export { useNavigationFlow } from './useNavigationFlow';

// Case list preferences
export { useCaseListPreferences } from './useCaseListPreferences';

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

// File import coordination
export { useImportListeners } from './useImportListeners';

// File data synchronization
export { useFileDataSync } from './useFileDataSync';

// Alerts flow management
export { useAlertsFlow } from './useAlertsFlow';

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