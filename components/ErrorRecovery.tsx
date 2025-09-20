import React, { createContext, useContext, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { fileDataProvider } from '../utils/fileDataProvider';
import { useFileStorage } from '../contexts/FileStorageContext';

interface ErrorRecoveryContext {
  isRecovering: boolean;
  lastError: Error | null;
  recover: (options?: RecoveryOptions) => Promise<void>;
  reportRecoveryAttempt: (success: boolean, method: string) => void;
}

interface RecoveryOptions {
  method?: 'reload-data' | 'reset-state' | 'refresh-page' | 'reconnect-filesystem';
  showProgress?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

const ErrorRecoveryContext = createContext<ErrorRecoveryContext | null>(null);

export function ErrorRecoveryProvider({ children }: { children: React.ReactNode }) {
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const { connectToFolder, loadExistingData } = useFileStorage();

  const reportRecoveryAttempt = useCallback((success: boolean, method: string) => {
    console.log(`Recovery attempt ${success ? 'succeeded' : 'failed'}: ${method}`);
    
    if (success) {
      toast.success('Recovery successful', {
        description: `Application recovered using: ${method}`,
      });
    } else {
      toast.error('Recovery failed', {
        description: `Failed to recover using: ${method}`,
      });
    }
  }, []);

  const recover = useCallback(async (options: RecoveryOptions = {}) => {
    const { 
      method = 'reload-data', 
      showProgress = true, 
      onSuccess, 
      onError 
    } = options;
    
    if (isRecovering) {
      console.warn('Recovery already in progress');
      return;
    }

    setIsRecovering(true);
    const toastId = showProgress ? toast.loading(`Attempting recovery: ${method}...`) : undefined;

    try {
      switch (method) {
        case 'reload-data':
          await recoverByReloadingData();
          break;
        case 'reset-state':
          await recoverByResettingState();
          break;
        case 'reconnect-filesystem':
          await recoverByReconnectingFilesystem();
          break;
        case 'refresh-page':
          window.location.reload();
          return; // Don't continue execution
        default:
          throw new Error(`Unknown recovery method: ${method}`);
      }

      reportRecoveryAttempt(true, method);
      setLastError(null);
      
      if (onSuccess) {
        onSuccess();
      }

      if (toastId) {
        toast.success('Recovery successful', { id: toastId });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Recovery failed');
      console.error('Recovery failed:', err);
      
      setLastError(err);
      reportRecoveryAttempt(false, method);
      
      if (onError) {
        onError(err);
      }

      if (toastId) {
        toast.error('Recovery failed', { id: toastId });
      }
    } finally {
      setIsRecovering(false);
    }
  }, [isRecovering, reportRecoveryAttempt, connectToFolder, loadExistingData]);

  const recoverByReloadingData = async () => {
    console.log('Attempting recovery by reloading data...');
    
    // Try to reload data from the file system
    const api = fileDataProvider.getAPI();
    if (api) {
      try {
        // Force reload from file system
        await loadExistingData();
        console.log('Successfully reloaded data from file system');
      } catch (error) {
        console.warn('Failed to reload from file system, trying cache...');
        
        // Fallback: try to reload from cached data
        if (api.internalData && api.internalData.cases) {
          console.log('Using cached data for recovery');
        } else {
          throw new Error('No data available for recovery');
        }
      }
    } else {
      throw new Error('No data API available');
    }
  };

  const recoverByResettingState = async () => {
    console.log('Attempting recovery by resetting state...');
    
    // Clear localStorage data if any
    try {
      localStorage.removeItem('cmsnext_error_reports');
      sessionStorage.clear();
    } catch (error) {
      console.warn('Could not clear storage:', error);
    }
    
    // Try to reload from file system with fresh state
    try {
      await loadExistingData();
    } catch (error) {
      console.warn('Could not reload data after state reset');
      // Continue - app will start with empty state
    }
  };

  const recoverByReconnectingFilesystem = async () => {
    console.log('Attempting recovery by reconnecting to file system...');
    
    try {
      await connectToFolder();
      await loadExistingData();
    } catch (error) {
      throw new Error('Failed to reconnect to file system');
    }
  };

  return (
    <ErrorRecoveryContext.Provider value={{
      isRecovering,
      lastError,
      recover,
      reportRecoveryAttempt,
    }}>
      {children}
    </ErrorRecoveryContext.Provider>
  );
}

export function useErrorRecovery() {
  const context = useContext(ErrorRecoveryContext);
  if (!context) {
    throw new Error('useErrorRecovery must be used within ErrorRecoveryProvider');
  }
  return context;
}

/**
 * Enhanced error fallback component with recovery options
 */
interface RecoveryErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  compact?: boolean;
}

export function RecoveryErrorFallback({ 
  error, 
  resetError, 
  compact = false 
}: RecoveryErrorFallbackProps) {
  const { recover, isRecovering } = useErrorRecovery();

  const handleRecover = async (method: RecoveryOptions['method']) => {
    await recover({
      method,
      onSuccess: () => {
        if (resetError) {
          resetError();
        }
      },
    });
  };

  return (
    <div className={`flex items-center justify-center ${compact ? 'min-h-[200px] p-4' : 'min-h-[300px] p-6'}`}>
      <div className={`w-full p-6 bg-card border border-border rounded-lg shadow-sm ${compact ? 'max-w-sm' : 'max-w-md'}`}>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-destructive/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h3 className={`font-semibold text-foreground mb-2 ${compact ? 'text-base' : 'text-lg'}`}>
            Something went wrong
          </h3>
          
          <p className={`text-muted-foreground mb-6 ${compact ? 'text-xs' : 'text-sm'}`}>
            {error?.message || 'An unexpected error occurred'}
          </p>

          <div className="space-y-2">
            <button
              onClick={() => handleRecover('reload-data')}
              disabled={isRecovering}
              className={`w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 ${compact ? 'text-xs' : 'text-sm'}`}
            >
              {isRecovering ? 'Recovering...' : 'Reload Data'}
            </button>
            
            <button
              onClick={() => handleRecover('reset-state')}
              disabled={isRecovering}
              className={`w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors disabled:opacity-50 ${compact ? 'text-xs' : 'text-sm'}`}
            >
              Reset Application
            </button>
            
            <button
              onClick={() => handleRecover('refresh-page')}
              disabled={isRecovering}
              className={`w-full px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/90 transition-colors disabled:opacity-50 ${compact ? 'text-xs' : 'text-sm'}`}
            >
              Refresh Page
            </button>
          </div>

          {/* Development error details */}
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4 text-left">
              <summary className={`cursor-pointer text-muted-foreground hover:text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                Error Details (Development)
              </summary>
              <div className={`mt-2 p-2 bg-muted rounded font-mono overflow-auto ${compact ? 'text-xs max-h-20' : 'text-xs max-h-24'}`}>
                <div className="text-destructive font-semibold mb-1">
                  {error.name}: {error.message}
                </div>
                {error.stack && (
                  <pre className="whitespace-pre-wrap text-muted-foreground text-xs">
                    {error.stack.slice(0, compact ? 150 : 200)}...
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorRecoveryProvider;