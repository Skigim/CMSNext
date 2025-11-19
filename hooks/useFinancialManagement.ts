import { useMemo } from 'react';
import { useFileStorage } from '@/contexts/FileStorageContext';
import ApplicationState from '@/application/ApplicationState';
import StorageRepository from '@/infrastructure/storage/StorageRepository';
import { FinancialManagementService } from '@/application/services/FinancialManagementService';

export function useFinancialManagement() {
  const { fileStorageService } = useFileStorage();

  const service = useMemo(() => {
    if (!fileStorageService) return null;
    
    const appState = ApplicationState.getInstance();
    const repository = new StorageRepository(fileStorageService);
    return new FinancialManagementService(appState, repository);
  }, [fileStorageService]);

  return service;
}
