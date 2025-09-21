import { useContext, createContext, ReactNode, useMemo } from 'react';
import DataManager from '../utils/DataManager';
import { useFileStorage } from './FileStorageContext';

interface DataManagerContextType {
  dataManager: DataManager | null;
}

const DataManagerContext = createContext<DataManagerContextType | null>(null);

interface DataManagerProviderProps {
  children: ReactNode;
}

export function DataManagerProvider({ children }: DataManagerProviderProps) {
  const { service, isConnected, status } = useFileStorage();
  
  // Memoize DataManager creation to prevent recreation on every render
  const dataManager = useMemo(() => {
    if (!service) return null;
    console.log('[DataManagerProvider] Creating new DataManager instance');
    return new DataManager({ fileService: service });
  }, [service]); // Only recreate when service changes

  console.log('[DataManagerProvider] Render:', {
    hasService: !!service,
    isConnected,
    hasDataManager: !!dataManager,
    statusStatus: status?.status,
    permissionStatus: status?.permissionStatus
  });

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