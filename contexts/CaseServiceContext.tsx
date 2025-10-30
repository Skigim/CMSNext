import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { CaseManagementAdapter } from '@/application/services/CaseManagementAdapter';
import { useDataManagerSafe } from './DataManagerContext';

interface CaseServiceContextValue {
  service: CaseManagementAdapter;
}

const CaseServiceContext = createContext<CaseServiceContextValue | null>(null);

interface CaseServiceProviderProps {
  children: ReactNode;
}

/**
 * Provider for CaseManagementAdapter service.
 * 
 * This provides a singleton instance of the case management service
 * that can be consumed by hooks and components throughout the app.
 */
export function CaseServiceProvider({ children }: CaseServiceProviderProps) {
  const dataManager = useDataManagerSafe();
  
  // Create service instance - memoized to prevent recreation on every render
  const service = useMemo(() => new CaseManagementAdapter(dataManager), [dataManager]);
  
  return (
    <CaseServiceContext.Provider value={{ service }}>
      {children}
    </CaseServiceContext.Provider>
  );
}

/**
 * Hook to access the CaseManagementAdapter service.
 * Must be used within a CaseServiceProvider.
 */
export function useCaseService(): CaseManagementAdapter {
  const context = useContext(CaseServiceContext);
  
  if (!context) {
    throw new Error('useCaseService must be used within a CaseServiceProvider');
  }
  
  return context.service;
}
