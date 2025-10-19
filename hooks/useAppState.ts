import { useState, useCallback } from 'react';

/**
 * Hook for managing global application state
 * Centralizes view state, loading states, and application-wide flags
 */

export type AppView = 'dashboard' | 'list' | 'new' | 'details' | 'settings' | 'import';

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
}

export function useAppState(): UseAppStateReturn {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);

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
    clearGlobalError
  };
}