import { ThemeProvider } from "@/contexts/ThemeContext";
import { FileStorageProvider } from "@/contexts/FileStorageContext";
import { DataManagerProvider } from "@/contexts/DataManagerContext";
import { CategoryConfigProvider } from "@/contexts/CategoryConfigContext";
import { TemplateProvider } from "@/contexts/TemplateContext";
import { EncryptionProvider } from "@/contexts/EncryptionContext";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { FileSystemErrorBoundary } from "@/components/error/FileSystemErrorBoundary";
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
 * - CaseServiceProvider: Case management service layer
 * 
 * @param children - The application content to be wrapped with providers
 */
export function AppProviders({ children }: AppProvidersProps) {
  logger.lifecycle("Rendering provider hierarchy");

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <EncryptionProvider>
          <FileSystemErrorBoundary>
            <FileStorageProvider>
              <DataManagerProvider>
                <CategoryConfigProvider>
                  <TemplateProvider>
                    {children}
                  </TemplateProvider>
                </CategoryConfigProvider>
              </DataManagerProvider>
            </FileStorageProvider>
          </FileSystemErrorBoundary>
        </EncryptionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}