/**
 * Barrel exports for custom hooks
 * Provides clean import paths for all application-specific hooks
 */

// Utility hooks
export { useIsMounted } from './useIsMounted';
export { useCategoryEditorState } from './useCategoryEditorState';
export type { 
  EditorItem, 
  ItemMeta, 
  UseCategoryEditorStateOptions, 
  UseCategoryEditorStateReturn 
} from './useCategoryEditorState';

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
export { useNavigationLock } from './useNavigationLock';
export type { NavigationLock } from './useNavigationLock';

// Case list preferences
export { useCaseListPreferences } from './useCaseListPreferences';

// Alert list preferences
export { useAlertListPreferences } from './useAlertListPreferences';
export type { AlertFilters, AlertSortConfig, AlertListSortKey, AlertListSortDirection } from './useAlertListPreferences';

// Alerts CSV import
export { useAlertsCsvImport } from './useAlertsCsvImport';

// Financial item flow
export { useFinancialItemFlow } from './useFinancialItemFlow';

// Note flow
export { useNoteFlow } from './useNoteFlow';

// Note management operations  
export { useNotes } from './useNotes';

// Financial item management
export { useFinancialItems } from './useFinancialItems';

// Legacy view state (to be refactored)
export { useAppViewState } from './useAppViewState';

// File import coordination
export { useImportListeners } from './useImportListeners';

// File data synchronization
export { useFileDataSync } from './useFileDataSync';

// Alerts flow management
export { useAlertsFlow } from './useAlertsFlow';

// AVS import flow management
export { useAVSImportFlow } from './useAVSImportFlow';
export type { AVSImportState } from './useAVSImportFlow';

// Encryption file hooks
export { useEncryptionFileHooks } from './useEncryptionFileHooks';

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