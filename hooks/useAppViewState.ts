import { useState, useCallback } from 'react';
import type { FeatureFlagKey, FeatureFlags } from '@/utils/featureFlags';
import { DEFAULT_FLAGS } from '@/utils/featureFlags';

export type AppView = 'dashboard' | 'list' | 'new' | 'details' | 'settings' | 'import';

/**
 * Hook for managing global application state and view navigation
 * 
 * Centralizes:
 * - Current view and selected case for navigation
 * - Global loading states and data readiness flags
 * - UI preferences (sidebar, search)
 * - Error state and user feedback
 * - Feature flags for progressive enhancement
 * 
 * **View Types:**
 * - `dashboard`: Overview with widgets and summary
 * - `list`: Case list with filters and sorting
 * - `details`: Single case detail view
 * - `new`: New case creation form
 * - `settings`: App settings and configuration
 * - `import`: Data import workflows
 * 
 * **Lazy Initialization:**
 * State initialized on first hook call (not on mount), allows components
 * to define state locally and avoid prop drilling
 * 
 * **Usage Example:**
 * ```typescript
 * const appState = useAppViewState();
 * 
 * // Navigate to case
 * appState.navigateToCase(\"case-123\");\n * 
 * // Or set view directly
 * appState.setView(\"details\", \"case-123\");\n * 
 * // Error handling
 * appState.setGlobalError(\"Failed to save\");\n * setTimeout(() => appState.clearGlobalError(), 3000);\n * 
 * // Feature flags
 * if (appState.isFeatureEnabled(\"darkMode\")) {\n *   // Show dark mode option
 * }\n * ```
 * \n * @returns {UseAppStateReturn} App state with view, loading, UI, and feature management
 */

interface UseAppStateReturn {
  // View management
  currentView: AppView;
  selectedCaseId: string | null;
  
  // View actions
  setView: (view: AppView, caseId?: string) => void;
  navigateToCase: (caseId: string) => void;
  navigateToNewCase: () => void;
  navigateToDashboard: () => void;
  navigateToList: () => void;
  navigateToSettings: () => void;
  navigateToImport: () => void;
  
  // Global loading states
  isAppLoading: boolean;
  setAppLoading: (loading: boolean) => void;
  
  // Global flags
  isDataLoaded: boolean;
  setDataLoaded: (loaded: boolean) => void;
  
  // UI preferences
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Search and filters
  globalSearchTerm: string;
  setGlobalSearchTerm: (term: string) => void;
  
  // Error handling
  globalError: string | null;
  setGlobalError: (error: string | null) => void;
  clearGlobalError: () => void;

  // Feature flags
  featureFlags: FeatureFlags;
  isFeatureEnabled: (flag: FeatureFlagKey) => boolean;
  setFeatureFlags: (flags: Partial<FeatureFlags>) => void;
}

export function useAppViewState(): UseAppStateReturn {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [featureFlags, setFeatureFlagsState] = useState<FeatureFlags>(DEFAULT_FLAGS);

  const setView = useCallback((view: AppView, caseId?: string) => {
    setCurrentView(view);
    if (caseId) {
      setSelectedCaseId(caseId);
    } else if (view !== 'details') {
      setSelectedCaseId(null);
    }
  }, []);

  const navigateToCase = useCallback((caseId: string) => {
    setView('details', caseId);
  }, [setView]);

  const navigateToNewCase = useCallback(() => {
    setView('new');
  }, [setView]);

  const navigateToDashboard = useCallback(() => {
    setView('dashboard');
  }, [setView]);

  const navigateToList = useCallback(() => {
    setView('list');
  }, [setView]);

  const navigateToSettings = useCallback(() => {
    setView('settings');
  }, [setView]);

  const navigateToImport = useCallback(() => {
    setView('import');
  }, [setView]);

  const setAppLoading = useCallback((loading: boolean) => {
    setIsAppLoading(loading);
  }, []);

  const setDataLoaded = useCallback((loaded: boolean) => {
    setIsDataLoaded(loaded);
  }, []);

  const clearGlobalError = useCallback(() => {
    setGlobalError(null);
  }, []);

  const isFeatureEnabled = useCallback((flag: FeatureFlagKey) => {
    return Boolean(featureFlags[flag]);
  }, [featureFlags]);

  const setFeatureFlags = useCallback((flags: Partial<FeatureFlags>) => {
    setFeatureFlagsState(prev => ({ ...prev, ...flags }));
  }, []);

  return {
    // View management
    currentView,
    selectedCaseId,
    
    // View actions
    setView,
    navigateToCase,
    navigateToNewCase,
    navigateToDashboard,
    navigateToList,
    navigateToSettings,
    navigateToImport,
    
    // Global loading states
    isAppLoading,
    setAppLoading,
    
    // Global flags
    isDataLoaded,
    setDataLoaded,
    
    // UI preferences
    sidebarCollapsed,
    setSidebarCollapsed,
    
    // Search and filters
    globalSearchTerm,
    setGlobalSearchTerm,
    
    // Error handling
    globalError,
    setGlobalError,
    clearGlobalError,

    // Feature flags
    featureFlags,
    isFeatureEnabled,
    setFeatureFlags,
  };
}
