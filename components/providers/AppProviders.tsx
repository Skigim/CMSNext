import { useCallback } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { FileStorageProvider } from "@/contexts/FileStorageContext";
import { DataManagerProvider } from "@/contexts/DataManagerContext";
import { CategoryConfigProvider } from "@/contexts/CategoryConfigContext";
import ErrorBoundary from "@/components/error/ErrorBoundary";
import FileSystemErrorBoundary from "@/components/error/FileSystemErrorBoundary";
import { getFileStorageFlags } from "@/utils/fileStorageFlags";
import { createLogger } from "@/utils/logger";

const logger = createLogger("AppProviders");

interface AppProvidersProps {
  children: React.ReactNode;
}

/**
 * AppProviders component wraps the entire application with all necessary context providers
 * 
 * Provider hierarchy:
 * - ErrorBoundary: Global error catching and recovery
 * - ThemeProvider: Theme management and switching
 * - FileSystemErrorBoundary: File system specific error handling
 * - FileStorageProvider: File system access and data persistence
 * - DataManagerProvider: Data management operations
 * 
 * @param children - The application content to be wrapped with providers
 */
export function AppProviders({ children }: AppProvidersProps) {
  logger.lifecycle("Rendering provider hierarchy");
  
  // Memoize callbacks to prevent FileStorageProvider prop changes
  const getDataFunction = useCallback(() => {
    // Skip during connect flow to prevent empty data from being saved
    if (window.location.hash === '#connect-to-existing') {
      return null;
    }
    
    // Don't save if we're still in loading/setup phase
    if (getFileStorageFlags().inSetupPhase) {
      return null;
    }
    
    // DataManager is stateless - we'll use the React state from useCaseManagement
    // This is passed via the context and accessed through the cases state
    // The FileStorageProvider will get data through onDataLoaded callback instead
    return null; // DataManager handles its own file operations
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <FileSystemErrorBoundary>
          <FileStorageProvider 
            getDataFunction={getDataFunction}
          >
            <DataManagerProvider>
              <CategoryConfigProvider>
                {children}
              </CategoryConfigProvider>
            </DataManagerProvider>
          </FileStorageProvider>
        </FileSystemErrorBoundary>
      </ThemeProvider>
    </ErrorBoundary>
  );
}