import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { NoteManagementService } from '@/application/services/NoteManagementService';
import { ApplicationState } from '@/application/ApplicationState';
import { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import { useFileStorage } from './FileStorageContext';
import { NoteServiceFactory } from '@/application/services/NoteServiceFactory';
import { createLogger } from '@/utils/logger';

const logger = createLogger('NoteServiceProvider');

interface NoteServiceContextValue {
  service: NoteManagementService;
}

const NoteServiceContext = createContext<NoteServiceContextValue | null>(null);

interface NoteServiceProviderProps {
  children: ReactNode;
}

/**
 * Provider for NoteManagementService.
 * 
 * This provides a singleton instance of the note management service
 * that can be consumed by hooks and components throughout the app.
 */
export function NoteServiceProvider({ children }: NoteServiceProviderProps) {
  const { service: fileService } = useFileStorage();
  const [service, setService] = useState<NoteManagementService | null>(null);

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
    const noteService = NoteServiceFactory.getInstance(appState, storage);

    (async () => {
      try {
        // Ensure ApplicationState is hydrated (this happens in CaseServiceProvider)
        // We just need to wait for it to be ready
        await appState.hydrate(storage);

        if (!cancelled) {
          setService(noteService);
          logger.lifecycle('Note service initialized');
        }
      } catch (error) {
        if (!cancelled) {
          logger.error('Failed to initialize note service', { error });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileService]);

  // Don't render children until service is available
  if (!service) {
    return null;
  }

  return (
    <NoteServiceContext.Provider value={{ service }}>
      {children}
    </NoteServiceContext.Provider>
  );
}

/**
 * Hook to access NoteManagementService from React components
 * 
 * @throws Error if used outside NoteServiceProvider
 */
export function useNoteService(): NoteManagementService {
  const context = useContext(NoteServiceContext);

  if (!context) {
    throw new Error('useNoteService must be used within NoteServiceProvider');
  }

  return context.service;
}
