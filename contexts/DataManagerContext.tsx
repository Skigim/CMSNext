import { useContext, createContext, ReactNode } from 'react';
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
  const { service } = useFileStorage();
  
  // Create DataManager instance when file service is available
  const dataManager = service ? new DataManager({ fileService: service }) : null;

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