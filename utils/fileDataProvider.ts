import { FileStorageAPI } from "./fileStorageAPI";

/**
 * Global file-based data provider
 * This replaces localStorage as the primary data storage method
 */
class FileDataProvider {
  private api: FileStorageAPI | null = null;
  private fileService: any = null;

  setFileService(service: any): void {
    this.fileService = service;
    // Always create API instance fresh - don't preserve old data
    // Data will be loaded explicitly through handleFileDataLoaded or API calls
    this.api = new FileStorageAPI(service);
  }

  getAPI(): FileStorageAPI | null {
    return this.api;
  }

  getFileService(): any {
    return this.fileService;
  }

  isReady(): boolean {
    return this.api !== null;
  }

  async initialize(): Promise<boolean> {
    if (!this.fileService) {
      return false;
    }

    try {
      // Check if we have stored directory access
      const { handle, permission } = await this.fileService.restoreLastDirectoryAccess();
      
      if (handle && permission === 'granted') {
        // We have access, try to load existing data
        await this.fileService.loadExistingData();
        return true;
      }
      
      return false; // Need to request access
    } catch (error) {
      console.error('Failed to initialize file data provider:', error);
      return false;
    }
  }

  async requestDirectoryAccess(): Promise<boolean> {
    if (!this.fileService) {
      return false;
    }

    try {
      const success = await this.fileService.connect();
      if (success && this.api) {
        // Reload data after successful connection
        await this.api.getAllCases(); // This will trigger a data load
      }
      return success;
    } catch (error) {
      console.error('Failed to request directory access:', error);
      return false;
    }
  }

  async ensurePermission(): Promise<boolean> {
    if (!this.fileService) {
      return false;
    }

    return await this.fileService.ensurePermission();
  }

  getPermissionStatus(): string {
    if (!this.fileService) {
      return 'unavailable';
    }

    return this.fileService.getStatus().permissionStatus;
  }

  isSupported(): boolean {
    if (!this.fileService) {
      return false;
    }
    return this.fileService.isSupported();
  }

  // Handle file data loading from AutosaveFileService
  handleFileDataLoaded(data: any): void {
    console.log(`[FileDataProvider] handleFileDataLoaded called with:`, data ? `${data.cases?.length || 0} cases` : 'null data');
    if (this.api) {
      this.api.updateInternalData(data);
    }
  }

  // Force clear internal data (for debugging)
  clearInternalData(): void {
    if (this.api) {
      this.api.updateInternalData({ cases: [], exported_at: new Date().toISOString(), total_cases: 0 });
    }
  }
}

// Global instance
export const fileDataProvider = new FileDataProvider();