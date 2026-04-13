import { useContext, createContext, ReactNode, useMemo, useEffect } from 'react';
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
  /** Whether initial workspace load has completed */
  isWorkspaceReady: boolean;
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
export function DataManagerProvider({ children }: Readonly<DataManagerProviderProps>) {
  const { service, fileStorageService, isConnected, isWorkspaceReady, status } = useFileStorage();
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

  const contextValue = useMemo(
    () => ({ dataManager, isWorkspaceReady }),
    [dataManager, isWorkspaceReady],
  );

  return (
    <DataManagerContext.Provider value={contextValue}>
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
  
  if (!context.dataManager || !context.isWorkspaceReady) {
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
  if (!context?.isWorkspaceReady) {
    return null;
  }

  return context.dataManager || null;
}

/**
 * Hook to access DataManager during startup flows before workspace readiness is published.
 *
 * This is reserved for the startup migration and initial case-load path.
 */
export function useStartupDataManagerSafe() {
  const context = useContext(DataManagerContext);
  return context?.dataManager || null;
}
