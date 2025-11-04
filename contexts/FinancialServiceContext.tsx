import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { FinancialManagementService } from '@/application/services/FinancialManagementService';
import { ApplicationState } from '@/application/ApplicationState';
import { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import { useFileStorage } from './FileStorageContext';
import { FinancialServiceFactory } from '@/application/services/FinancialServiceFactory';
import { createLogger } from '@/utils/logger';

const logger = createLogger('FinancialServiceProvider');

interface FinancialServiceContextValue {
  service: FinancialManagementService;
}

const FinancialServiceContext = createContext<FinancialServiceContextValue | null>(null);

interface FinancialServiceProviderProps {
  children: ReactNode;
}

/**
 * Provider for FinancialManagementService.
 * 
 * This provides a singleton instance of the financial management service
 * that can be consumed by hooks and components throughout the app.
 */
export function FinancialServiceProvider({ children }: FinancialServiceProviderProps) {
  const { service: fileService } = useFileStorage();
  const [service, setService] = useState<FinancialManagementService | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!fileService) {
      setService(null);
      return () => {
        cancelled = true;
      };
    }

    const appState = ApplicationState.getInstance();
    const storage = new StorageRepository(fileService);
    const financialService = FinancialServiceFactory.getInstance(storage);

    (async () => {
      try {
        // Ensure ApplicationState is hydrated (this happens in CaseServiceProvider)
        // We just need to wait for it to be ready
        await appState.hydrate(storage);

        if (!cancelled) {
          setService(financialService);
        }
      } catch (error) {
        // Handle AbortError as a non-error (user cancellation)
        if (error instanceof Error && error.name === 'AbortError') {
          // Silent cancellation - don't log or show toast
          return;
        }

        // Log and notify user for all other errors
        logger.error('Failed to initialize financial service', {
          error: error instanceof Error ? error.message : String(error),
        });
        toast.error('Failed to initialize financial management');
        // Don't set service on initialization failure
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileService]);

  const contextValue = useMemo(
    () => (service ? { service } : null),
    [service],
  );

  if (!contextValue) {
    // Return a placeholder context while service initializes
    return <>{children}</>;
  }

  return (
    <FinancialServiceContext.Provider value={contextValue}>
      {children}
    </FinancialServiceContext.Provider>
  );
}

/**
 * Hook to access the Financial Management Service from context.
 * 
 * @throws {Error} If used outside of FinancialServiceProvider
 */
export function useFinancialService(): FinancialManagementService {
  const context = useContext(FinancialServiceContext);
  
  if (!context) {
    throw new Error('useFinancialService must be used within FinancialServiceProvider');
  }

  return context.service;
}
