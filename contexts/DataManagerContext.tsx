import { useContext, createContext, ReactNode, useMemo, useEffect, useRef } from 'react';
import { DataManager } from '@/utils/DataManager';
import { useFileStorage } from '@/contexts/FileStorageContext';
import { createLogger } from '@/utils/logger';

/**
 * DataManager context value - provides access to the central data orchestration layer.
 * 
 * @interface DataManagerContextType
 */
interface DataManagerContextType {
  /** Instance of DataManager, or null if file service not connected */
  dataManager: DataManager | null;
}

const DataManagerContext = createContext<DataManagerContextType | null>(null);

const logger = createLogger('DataManagerProvider');

/**
 * Props for DataManagerProvider component.
 * @interface DataManagerProviderProps
 */
interface DataManagerProviderProps {
  /** React child components */
  children: ReactNode;
}

/**
 * DataManagerProvider - Provides access to the DataManager orchestration layer.
 * 
 * Creates and manages a single DataManager instance that orchestrates all case-related
 * data operations. Depends on FileStorageProvider being present in the tree.
 * 
 * ## Architecture
 * 
 * ```
 * DataManagerProvider
 *     ↓
 * DataManager (central orchestration)
 *     ↓
 * Service Layer (Case, Financial, Note, Alert, etc.)
 *     ↓
 * FileStorageService → AutosaveFileService → File System
 * ```
 * 
 * ## Lifecycle
 * 
 * - Waits for FileStorage to connect before creating DataManager
 * - Runs financial history migration once on first connection
 * - Cleans up on unmount
 * 
 * ## Setup
 * 
 * ```typescript
 * function App() {
 *   return (
 *     <FileStorageProvider>
 *       <DataManagerProvider>
 *         <YourApp />
 *       </DataManagerProvider>
 *     </FileStorageProvider>
 *   );
 * }
 * ```
 * 
 * ## Usage
 * 
 * ```typescript
 * function MyComponent() {
 *   const dataManager = useDataManager(); // Throws if not available
 *   const cases = await dataManager.getAllCases();
 * }
 * ```
 * 
 * @component
 * @param {DataManagerProviderProps} props - Provider configuration
 * @returns {ReactNode} Provider wrapping children
 * 
 * @see {@link useDataManager} to access DataManager instance
 * @see {@link DataManager} for available operations
 */
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

/**
 * Hook to access the DataManager instance.
 * 
 * Provides access to the central orchestration layer for all data operations.
 * Throws if DataManager is not available (FileStorage not connected).
 * 
 * Use when you need to perform data operations and can guarantee availability.
 * 
 * ## Example
 * 
 * ```typescript
 * function MyCaseComponent() {
 *   const dataManager = useDataManager(); // Throws if not available
 *   const cases = await dataManager.getAllCases();
 * }
 * ```
 * 
 * @hook
 * @returns {DataManager} DataManager instance for all data operations
 * @throws {Error} If used outside DataManagerProvider or FileStorage not connected
 * 
 * @see {@link useDataManagerSafe} for safe alternative that returns null
 * @see {@link DataManager} for available operations
 */
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
 * Hook to safely access the DataManager instance (returns null if unavailable).
 * 
 * Use when you need to check availability before using, or when DataManager
 * might not be available yet (e.g., during initialization).
 * 
 * ## Example
 * 
 * ```typescript
 * function MyComponent() {
 *   const dataManager = useDataManagerSafe(); // Returns null if not available
 *   
 *   if (!dataManager) {
 *     return <LoadingSpinner />;
 *   }
 *   
 *   // Safe to use dataManager here
 * }
 * ```
 * 
 * @hook
 * @returns {DataManager | null} DataManager instance or null if not available
 * 
 * @see {@link useDataManager} for throwing alternative (stricter)
 */
export function useDataManagerSafe() {
  const context = useContext(DataManagerContext);
  return context?.dataManager || null;
}