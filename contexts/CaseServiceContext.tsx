import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { CaseManagementAdapter } from '@/application/services/CaseManagementAdapter';
import { CaseManagementService } from '@/application/services/CaseManagementService';
import { ApplicationState } from '@/application/ApplicationState';
import { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import { useDataManagerSafe } from './DataManagerContext';
import { useFileStorage } from './FileStorageContext';
import { createCaseService, type CaseServiceContract, type DomainServiceDependencies } from '@/application/services/CaseServiceFactory';
import { getRefactorFlags } from '@/utils/featureFlags';
import { createLogger } from '@/utils/logger';

const logger = createLogger('CaseServiceProvider');

interface CaseServiceContextValue {
  service: CaseServiceContract;
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
  const { service: fileService } = useFileStorage();

  const [domainDeps, setDomainDeps] = useState<DomainServiceDependencies | null>(null);

  const { USE_NEW_ARCHITECTURE, USE_CASES_DOMAIN } = getRefactorFlags();
  const useDomainService = USE_NEW_ARCHITECTURE && USE_CASES_DOMAIN;
  
  // Create service instance - memoized to prevent recreation on every render
  const service = useMemo(() => new CaseManagementAdapter(dataManager), [dataManager]);

  useEffect(() => {
    let cancelled = false;

    if (!useDomainService || !fileService) {
      setDomainDeps(null);
      return () => {
        cancelled = true;
      };
    }

    const appState = ApplicationState.getInstance();
    const storage = new StorageRepository(fileService);
    const domainService = new CaseManagementService(appState, storage);

    (async () => {
      try {
        await appState.hydrate(storage);

        if (!cancelled) {
          setDomainDeps({ service: domainService, appState, storage });
        }
      } catch (error) {
        // Handle AbortError as a non-error (user cancellation)
        if (error instanceof Error && error.name === 'AbortError') {
          // Silent cancellation - don't log or show toast
          return;
        }

        // Log and notify user for all other errors
        logger.error('Failed to hydrate application state for domain service', {
          error: error instanceof Error ? error.message : String(error),
        });
        toast.error('Failed to initialize case management');
        // Don't set domainDeps on hydration failure
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileService, useDomainService]);

  const facade = useMemo(
    () => createCaseService({
      legacy: service,
      domain: domainDeps,
      useDomain: useDomainService,
    }),
    [domainDeps, service, useDomainService],
  );
  
  return (
    <CaseServiceContext.Provider value={{ service: facade }}>
      {children}
    </CaseServiceContext.Provider>
  );
}

/**
 * Hook to access the CaseManagementAdapter service.
 * Must be used within a CaseServiceProvider.
 */
export function useCaseService(): CaseServiceContract {
  const context = useContext(CaseServiceContext);
  
  if (!context) {
    throw new Error('useCaseService must be used within a CaseServiceProvider');
  }
  
  return context.service;
}
