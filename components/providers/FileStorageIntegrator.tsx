import { useEffect } from "react";
import { useFileStorage } from "../../contexts/FileStorageContext";
import { useDataManagerSafe } from "../../contexts/DataManagerContext";
import { useEncryptionFileHooks } from "../../hooks/useEncryptionFileHooks";
import { markFileStorageInitialized, resetFileStorageFlags } from "../../utils/fileStorageFlags";

interface FileStorageIntegratorProps {
  children: React.ReactNode;
}

/**
 * FileStorageIntegrator component handles the integration between file storage service and data manager
 * 
 * Responsibilities:
 * - Manages file storage initialization flags
 * - Cleans up leftover session data from previous sessions
 * - Integrates DataManager with FileStorageContext
 * - Handles startup initialization processes
 * 
 * This component ensures proper cleanup and initialization of the file storage system
 * when the application starts up.
 * 
 * @param children - The application content to be rendered after initialization
 */
export function FileStorageIntegrator({ children }: FileStorageIntegratorProps) {
  const { service } = useFileStorage();
  const dataManager = useDataManagerSafe();
  
  // Wire up encryption hooks to the file service
  // This enables automatic encryption/decryption during file operations
  useEncryptionFileHooks();
  
  useEffect(() => {
    // Only set the service if we have one and it's different from current
    if (service && dataManager) {
      // Note: DataManager integration happens through FileStorageContext
      // This component is mainly for initialization flags
    }
    
    // Clean up any leftover flags from previous sessions on startup
    if (markFileStorageInitialized()) {
      resetFileStorageFlags();
    }
  }, [service, dataManager]);

  return <>{children}</>;
}