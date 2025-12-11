import { useContext, createContext, ReactNode, useMemo, useEffect, useRef } from 'react';
import DataManager from '@/utils/DataManager';
import { useFileStorage } from '@/contexts/FileStorageContext';
import { createLogger } from '@/utils/logger';

interface DataManagerContextType {
  dataManager: DataManager | null;
}

const DataManagerContext = createContext<DataManagerContextType | null>(null);

const logger = createLogger('DataManagerProvider');

interface DataManagerProviderProps {
  children: ReactNode;
}

export function DataManagerProvider({ children }: DataManagerProviderProps) {
  const { service, fileStorageService, isConnected, status } = useFileStorage();
  const hasMigrated = useRef(false);
  
  // Memoize DataManager creation to prevent recreation on every render
  const dataManager = useMemo(() => {
    if (!service) return null;
    logger.info('Creating DataManager instance', {
      serviceRunning: service?.getStatus?.()?.isRunning ?? false,
    });
    return new DataManager({
      fileService: service,
      fileStorageService: fileStorageService || undefined,
    });
  }, [service, fileStorageService]); // Only recreate when service changes

  useEffect(() => {
    logger.debug('Provider state updated', {
      hasService: !!service,
      isConnected,
      hasDataManager: !!dataManager,
      status: status?.status,
      permissionStatus: status?.permissionStatus,
    });
  }, [dataManager, isConnected, service, status]);

  // Run financial history migration once when connected
  useEffect(() => {
    if (!dataManager || !isConnected || hasMigrated.current) return;
    
    hasMigrated.current = true;
    dataManager.migrateFinancialsWithoutHistory().then((count) => {
      if (count > 0) {
        logger.info('Migrated financial items without history', { count });
      }
    }).catch((err) => {
      logger.error('Failed to migrate financial items', { error: err });
    });
  }, [dataManager, isConnected]);

  return (
    <DataManagerContext.Provider value={{ dataManager }}>
      {children}
    </DataManagerContext.Provider>
  );
}

export function useDataManager() {
  const context = useContext(DataManagerContext);
  if (!context) {
    throw new Error('useDataManager must be used within a DataManagerProvider');
  }
  
  if (!context.dataManager) {
    throw new Error('DataManager is not available - file service not connected');
  }
  
  return context.dataManager;
}

/**
 * Hook that safely returns DataManager or null if not available
 * Use this when you need to check availability before using
 */
export function useDataManagerSafe() {
  const context = useContext(DataManagerContext);
  return context?.dataManager || null;
}