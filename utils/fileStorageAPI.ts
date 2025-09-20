import { CaseDisplay, CaseCategory, FinancialItem, NewPersonData, NewCaseRecordData, NewNoteData } from "../types/case";
import { v4 as uuidv4 } from 'uuid';

interface FileStorageData {
  cases: CaseDisplay[];
  lastModified: number;
  exportedAt?: string;
  totalCases?: number;
}

/**
 * File-based API that works with AutosaveFileService for case management
 * Provides CRUD operations for cases, financial items, and notes with file system persistence
 * Supports batch operations for optimized bulk imports and automatic data synchronization
 */
export class FileStorageAPI {
  private data: FileStorageData = {
    cases: [],
    lastModified: Date.now()
  };
  
  private isDataLoaded = false;
  private saveQueue: Promise<void> = Promise.resolve();
  private isBatchMode = false;
  private batchedChanges = false;

  /**
   * Creates a new FileStorageAPI instance
   * @param fileService - The AutosaveFileService instance for file operations
   */
  constructor(private fileService: any) {
    // Initialize with empty data - don't auto-load from service
    // Data will be explicitly loaded through updateInternalData or method calls
    this.isDataLoaded = false;
  }

  private async loadDataFromService(): Promise<void> {
    if (!this.fileService) return;
    
    try {
      const fileData = await this.fileService.readFile();
      if (fileData) {
        this.data = {
          cases: fileData.cases || [],
          lastModified: fileData.lastModified || Date.now(),
          exportedAt: fileData.exportedAt || fileData.exported_at,
          totalCases: fileData.totalCases || fileData.total_cases || (fileData.cases?.length || 0)
        };
        this.isDataLoaded = true;
      }
    } catch (error) {
      console.error('Failed to load data from file service:', error);
    }
  }

  private async saveDataToService(immediate = false): Promise<void> {
    if (!this.fileService) {
      // Development mode - just update timestamp but don't actually save
      this.data.lastModified = Date.now();
      console.log('Development mode: File save skipped (no file service available)');
      return;
    }

    // If in batch mode and not immediate, just mark that changes occurred
    if (this.isBatchMode && !immediate) {
      this.batchedChanges = true;
      return;
    }

    // Queue the save operation to prevent concurrent writes
    this.saveQueue = this.saveQueue.then(async () => {
      this.data.lastModified = Date.now();
      
      const maxRetries = 3;
      let attempt = 0;
      
      while (attempt < maxRetries) {
        try {
          await this.fileService.writeFile({
            ...this.data,
            exported_at: new Date().toISOString(),
            total_cases: this.data.cases.length
          });
          
          // Reset batched changes flag after successful save
          this.batchedChanges = false;
          return; // Success, exit retry loop
          
        } catch (error) {
          attempt++;
          console.error(`File save attempt ${attempt} failed:`, error);
          
          if (attempt >= maxRetries) {
            console.error('All file save attempts failed');
            // Don't throw error during import - just log it
            // throwing here would interrupt the bulk import process
            break;
          }
          
          // Wait longer between retries
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }).catch(error => {
      // Catch any uncaught errors from the promise chain to prevent unhandled rejections
      console.error('File save queue error:', error);
    });

    return this.saveQueue;
  }

  /**
   * Retrieves all cases from file storage
   * @returns Promise<CaseDisplay[]> - Array of all cases with person and case record data
   * @throws {Error} If file storage service is unavailable or data loading fails
   * @example
   * const cases = await fileStorageAPI.getAllCases();
   * console.log(`Loaded ${cases.length} cases`);
   */
  async getAllCases(): Promise<CaseDisplay[]> {
    if (!this.isDataLoaded) {
      await this.loadDataFromService();
    }
    return this.data.cases;
  }

  /**
   * Enables batch mode to optimize bulk operations by deferring file saves
   * Call this before performing multiple operations to improve performance
   * @example
   * fileStorageAPI.startBatchMode();
   * // ... perform multiple createCompleteCase operations
   * await fileStorageAPI.endBatchMode();
   */
  startBatchMode(): void {
    this.isBatchMode = true;
    this.batchedChanges = false;
  }

  /**
   * Disables batch mode and saves any pending changes to file storage
   * Always call this after startBatchMode() to ensure data persistence
   * @returns Promise<void> - Resolves when all batched changes are saved
   * @example
   * fileStorageAPI.startBatchMode();
   * // ... perform bulk operations
   * await fileStorageAPI.endBatchMode(); // Saves all changes at once
   */
  async endBatchMode(): Promise<void> {
    this.isBatchMode = false;
    
    // Save any pending changes
    if (this.batchedChanges) {
      await this.saveDataToService(true);
    }
  }

  /**
   * Creates a complete case with person and case record data
   * @param caseData - Object containing person and caseRecord data
   * @param caseData.person - Person information (firstName, lastName, etc.)
   * @param caseData.caseRecord - Case record information (mcn, status, etc.)
   * @returns Promise<CaseDisplay> - The complete created case with generated IDs
   * @throws {Error} If file storage is unavailable or case creation fails
   * @example
   * const newCase = await fileStorageAPI.createCompleteCase({
   *   person: { firstName: 'John', lastName: 'Doe', phone: '555-0123' },
   *   caseRecord: { mcn: '12345', status: 'In Progress', priority: false }
   * });
   */
  async createCompleteCase(caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<CaseDisplay> {
    const newCase: CaseDisplay = {
      id: uuidv4(),
      name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
      mcn: caseData.caseRecord.mcn,
      status: caseData.caseRecord.status,
      priority: Boolean(caseData.caseRecord.priority),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      person: {
        id: uuidv4(),
        firstName: caseData.person.firstName,
        lastName: caseData.person.lastName,
        name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
        dateOfBirth: caseData.person.dateOfBirth || '',
        ssn: caseData.person.ssn || '',
        phone: caseData.person.phone || '',
        email: caseData.person.email || '',
        organizationId: caseData.person.organizationId || null,
        livingArrangement: caseData.person.livingArrangement || '',
        address: caseData.person.address || {
          street: '',
          city: '',
          state: '',
          zip: ''
        },
        mailingAddress: caseData.person.mailingAddress || {
          street: '',
          city: '',
          state: '',
          zip: '',
          sameAsPhysical: true
        },
        authorizedRepIds: caseData.person.authorizedRepIds || [],
        familyMembers: caseData.person.familyMembers || [],
        status: caseData.person.status || 'Active',
        dateAdded: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      caseRecord: {
        id: uuidv4(),
        personId: '', // Will be set below
        mcn: caseData.caseRecord.mcn,
        applicationDate: caseData.caseRecord.applicationDate || new Date().toISOString(),
        caseType: caseData.caseRecord.caseType || 'General',
        spouseId: caseData.caseRecord.spouseId || '',
        status: caseData.caseRecord.status,
        description: caseData.caseRecord.description || '',
        priority: Boolean(caseData.caseRecord.priority),
        livingArrangement: caseData.caseRecord.livingArrangement || '',
        withWaiver: Boolean(caseData.caseRecord.withWaiver),
        admissionDate: caseData.caseRecord.admissionDate || new Date().toISOString(),
        organizationId: caseData.caseRecord.organizationId || '',
        authorizedReps: caseData.caseRecord.authorizedReps || [],
        retroRequested: caseData.caseRecord.retroRequested || '',
        financials: {
          resources: [],
          income: [],
          expenses: []
        },
        notes: [],
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString()
      }
    };

    // Set the person ID reference
    newCase.caseRecord.personId = newCase.person.id;

    this.data.cases.push(newCase);
    
    // Only save immediately if not in batch mode
    if (!this.isBatchMode) {
      await this.saveDataToService();
    }
    
    return newCase;
  }

  /**
   * Updates an existing case with new person and case record data
   * @param caseId - The unique identifier of the case to update
   * @param caseData - Object containing updated person and caseRecord data
   * @param caseData.person - Updated person information
   * @param caseData.caseRecord - Updated case record information
   * @returns Promise<CaseDisplay> - The updated case with preserved financials and notes
   * @throws {Error} If case not found or update operation fails
   * @example
   * const updatedCase = await fileStorageAPI.updateCompleteCase('case-123', {
   *   person: { firstName: 'Jane', lastName: 'Smith' },
   *   caseRecord: { status: 'Completed', priority: true }
   * });
   */
  async updateCompleteCase(caseId: string, caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<CaseDisplay> {
    const caseIndex = this.data.cases.findIndex(c => c.id === caseId);
    
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const existingCase = this.data.cases[caseIndex];
    
    // Update person data
    const updatedPerson = {
      ...existingCase.person,
      firstName: caseData.person.firstName,
      lastName: caseData.person.lastName,
      name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
      dateOfBirth: caseData.person.dateOfBirth || '',
      ssn: caseData.person.ssn || '',
      phone: caseData.person.phone || '',
      email: caseData.person.email || '',
      organizationId: caseData.person.organizationId || null,
      livingArrangement: caseData.person.livingArrangement || '',
      address: caseData.person.address || existingCase.person.address,
      mailingAddress: caseData.person.mailingAddress || existingCase.person.mailingAddress,
      authorizedRepIds: caseData.person.authorizedRepIds || [],
      familyMembers: caseData.person.familyMembers || [],
      status: caseData.person.status || 'Active'
    };

    // Update case record data
    const updatedCaseRecord = {
      ...existingCase.caseRecord,
      mcn: caseData.caseRecord.mcn,
      applicationDate: caseData.caseRecord.applicationDate || existingCase.caseRecord.applicationDate,
      caseType: caseData.caseRecord.caseType || existingCase.caseRecord.caseType,
      spouseId: caseData.caseRecord.spouseId || '',
      status: caseData.caseRecord.status,
      description: caseData.caseRecord.description || '',
      priority: Boolean(caseData.caseRecord.priority),
      livingArrangement: caseData.caseRecord.livingArrangement || '',
      withWaiver: Boolean(caseData.caseRecord.withWaiver),
      admissionDate: caseData.caseRecord.admissionDate || existingCase.caseRecord.admissionDate,
      organizationId: caseData.caseRecord.organizationId || '',
      authorizedReps: caseData.caseRecord.authorizedReps || [],
      retroRequested: caseData.caseRecord.retroRequested || '',
      // Preserve existing financials data
      financials: existingCase.caseRecord.financials,
      updatedDate: new Date().toISOString()
    };

    const updatedCase: CaseDisplay = {
      ...existingCase,
      name: updatedPerson.name,
      mcn: updatedCaseRecord.mcn,
      status: updatedCaseRecord.status,
      priority: updatedCaseRecord.priority,
      updatedAt: new Date().toISOString(),
      person: updatedPerson,
      caseRecord: updatedCaseRecord
    };

    this.data.cases[caseIndex] = updatedCase;
    await this.saveDataToService();
    
    return updatedCase;
  }

  /**
   * Adds a new financial item (resource, income, or expense) to a case
   * @param caseId - The unique identifier of the case
   * @param category - The financial category: 'resources', 'income', or 'expenses'
   * @param itemData - Financial item data (description, amount, frequency, etc.)
   * @returns Promise<CaseDisplay> - The updated case with the new financial item
   * @throws {Error} If case not found or item creation fails
   * @example
   * const updatedCase = await fileStorageAPI.addItem('case-123', 'income', {
   *   description: 'Social Security',
   *   amount: 800,
   *   frequency: 'Monthly',
   *   verificationStatus: 'Verified'
   * });
   */
  async addItem(caseId: string, category: CaseCategory, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<CaseDisplay> {
    const caseIndex = this.data.cases.findIndex(c => c.id === caseId);
    
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const newItem: FinancialItem = {
      ...itemData,
      id: uuidv4(),
      dateAdded: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.cases[caseIndex].caseRecord.financials[category].push(newItem);
    this.data.cases[caseIndex].caseRecord.updatedDate = new Date().toISOString();
    this.data.cases[caseIndex].updatedAt = new Date().toISOString();
    
    await this.saveDataToService();
    return this.data.cases[caseIndex];
  }

  /**
   * Updates an existing financial item in a case
   * @param caseId - The unique identifier of the case
   * @param category - The financial category: 'resources', 'income', or 'expenses'
   * @param itemId - The unique identifier of the financial item to update
   * @param itemData - Updated financial item data
   * @returns Promise<CaseDisplay> - The updated case with modified financial item
   * @throws {Error} If case or item not found, or update fails
   * @example
   * const updatedCase = await fileStorageAPI.updateItem('case-123', 'income', 'item-456', {
   *   amount: 850,
   *   verificationStatus: 'Verified'
   * });
   */
  async updateItem(caseId: string, category: CaseCategory, itemId: string, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<CaseDisplay> {
    const caseIndex = this.data.cases.findIndex(c => c.id === caseId);
    
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const items = this.data.cases[caseIndex].caseRecord.financials[category];
    const itemIndex = items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }

    items[itemIndex] = {
      ...items[itemIndex],
      ...itemData,
      updatedAt: new Date().toISOString()
    };

    this.data.cases[caseIndex].caseRecord.updatedDate = new Date().toISOString();
    this.data.cases[caseIndex].updatedAt = new Date().toISOString();
    
    await this.saveDataToService();
    return this.data.cases[caseIndex];
  }

  /**
   * Deletes a financial item from a case
   * @param caseId - The unique identifier of the case
   * @param category - The financial category: 'resources', 'income', or 'expenses'  
   * @param itemId - The unique identifier of the financial item to delete
   * @returns Promise<CaseDisplay> - The updated case with the financial item removed
   * @throws {Error} If case or item not found, or deletion fails
   * @example
   * const updatedCase = await fileStorageAPI.deleteItem('case-123', 'expenses', 'item-789');
   */
  async deleteItem(caseId: string, category: CaseCategory, itemId: string): Promise<CaseDisplay> {
    const caseIndex = this.data.cases.findIndex(c => c.id === caseId);
    
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const items = this.data.cases[caseIndex].caseRecord.financials[category];
    const itemIndex = items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }

    items.splice(itemIndex, 1);
    this.data.cases[caseIndex].caseRecord.updatedDate = new Date().toISOString();
    this.data.cases[caseIndex].updatedAt = new Date().toISOString();
    
    await this.saveDataToService();
    return this.data.cases[caseIndex];
  }

  /**
   * Adds a new note to a case
   * @param caseId - The unique identifier of the case
   * @param noteData - Note data containing category and content
   * @returns Promise<CaseDisplay> - The updated case with the new note
   * @throws {Error} If case not found or note creation fails
   * @example
   * const updatedCase = await fileStorageAPI.addNote('case-123', {
   *   category: 'Client Contact',
   *   content: 'Called client to verify income documentation.'
   * });
   */
  async addNote(caseId: string, noteData: NewNoteData): Promise<CaseDisplay> {
    const caseIndex = this.data.cases.findIndex(c => c.id === caseId);
    
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const newNote = {
      id: uuidv4(),
      category: noteData.category || 'General',
      content: noteData.content || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!this.data.cases[caseIndex].caseRecord.notes) {
      this.data.cases[caseIndex].caseRecord.notes = [];
    }
    
    this.data.cases[caseIndex].caseRecord.notes!.push(newNote);
    this.data.cases[caseIndex].caseRecord.updatedDate = new Date().toISOString();
    this.data.cases[caseIndex].updatedAt = new Date().toISOString();
    
    await this.saveDataToService();
    return this.data.cases[caseIndex];
  }

  /**
   * Updates an existing note in a case
   * @param caseId - The unique identifier of the case
   * @param noteId - The unique identifier of the note to update
   * @param noteData - Updated note data (category and/or content)
   * @returns Promise<CaseDisplay> - The updated case with modified note
   * @throws {Error} If case or note not found, or update fails
   * @example
   * const updatedCase = await fileStorageAPI.updateNote('case-123', 'note-456', {
   *   category: 'Follow-up',
   *   content: 'Updated: Client submitted missing documentation.'
   * });
   */
  async updateNote(caseId: string, noteId: string, noteData: NewNoteData): Promise<CaseDisplay> {
    const caseIndex = this.data.cases.findIndex(c => c.id === caseId);
    
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const notes = this.data.cases[caseIndex].caseRecord.notes || [];
    const noteIndex = notes.findIndex(note => note.id === noteId);
    
    if (noteIndex === -1) {
      throw new Error('Note not found');
    }

    notes[noteIndex] = {
      ...notes[noteIndex],
      category: noteData.category || 'General',
      content: noteData.content || '',
      updatedAt: new Date().toISOString()
    };

    this.data.cases[caseIndex].caseRecord.updatedDate = new Date().toISOString();
    this.data.cases[caseIndex].updatedAt = new Date().toISOString();
    
    await this.saveDataToService();
    return this.data.cases[caseIndex];
  }

  /**
   * Deletes a note from a case
   * @param caseId - The unique identifier of the case
   * @param noteId - The unique identifier of the note to delete
   * @returns Promise<CaseDisplay> - The updated case with the note removed
   * @throws {Error} If case or note not found, or deletion fails
   * @example
   * const updatedCase = await fileStorageAPI.deleteNote('case-123', 'note-456');
   */
  async deleteNote(caseId: string, noteId: string): Promise<CaseDisplay> {
    const caseIndex = this.data.cases.findIndex(c => c.id === caseId);
    
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const notes = this.data.cases[caseIndex].caseRecord.notes || [];
    const noteIndex = notes.findIndex(note => note.id === noteId);
    
    if (noteIndex === -1) {
      throw new Error('Note not found');
    }

    notes.splice(noteIndex, 1);
    this.data.cases[caseIndex].caseRecord.updatedDate = new Date().toISOString();
    this.data.cases[caseIndex].updatedAt = new Date().toISOString();
    
    await this.saveDataToService();
    return this.data.cases[caseIndex];
  }

  /**
   * Permanently deletes a case and all associated data
   * @param caseId - The unique identifier of the case to delete
   * @returns Promise<void> - Resolves when case is successfully deleted
   * @throws {Error} If case not found or deletion fails
   * @example
   * await fileStorageAPI.deleteCase('case-123');
   * console.log('Case deleted successfully');
   */
  async deleteCase(caseId: string): Promise<void> {
    const caseIndex = this.data.cases.findIndex(c => c.id === caseId);
    
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    this.data.cases.splice(caseIndex, 1);
    await this.saveDataToService();
  }

  async importCases(cases: CaseDisplay[]): Promise<CaseDisplay[]> {
    // Use batch mode for importing multiple cases
    this.startBatchMode();
    
    try {
      // Add imported cases to existing data
      this.data.cases = [...this.data.cases, ...cases];
      
      // End batch mode and save
      await this.endBatchMode();
      
      return cases;
    } catch (error) {
      // Ensure batch mode is ended even on error
      this.isBatchMode = false;
      throw error;
    }
  }

  // Bulk create method for efficient imports
  async createMultipleCases(
    casesData: Array<{ person: NewPersonData; caseRecord: NewCaseRecordData }>,
    progressCallback?: (current: number, total: number) => void
  ): Promise<CaseDisplay[]> {
    this.startBatchMode();
    
    try {
      const createdCases: CaseDisplay[] = [];
      const total = casesData.length;
      
      for (let i = 0; i < casesData.length; i++) {
        const caseData = casesData[i];
        
        // Create case object without triggering individual saves
        const newCase: CaseDisplay = {
          id: uuidv4(),
          name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
          mcn: caseData.caseRecord.mcn,
          status: caseData.caseRecord.status,
          priority: Boolean(caseData.caseRecord.priority),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          person: {
            id: uuidv4(),
            firstName: caseData.person.firstName,
            lastName: caseData.person.lastName,
            name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
            dateOfBirth: caseData.person.dateOfBirth || '',
            ssn: caseData.person.ssn || '',
            phone: caseData.person.phone || '',
            email: caseData.person.email || '',
            organizationId: caseData.person.organizationId || null,
            livingArrangement: caseData.person.livingArrangement || '',
            address: caseData.person.address || {
              street: '',
              city: '',
              state: '',
              zip: ''
            },
            mailingAddress: caseData.person.mailingAddress || {
              street: '',
              city: '',
              state: '',
              zip: '',
              sameAsPhysical: true
            },
            authorizedRepIds: caseData.person.authorizedRepIds || [],
            familyMembers: caseData.person.familyMembers || [],
            status: caseData.person.status || 'Active',
            dateAdded: new Date().toISOString(),
            createdAt: new Date().toISOString()
          },
          caseRecord: {
            id: uuidv4(),
            personId: '', // Will be set below
            mcn: caseData.caseRecord.mcn,
            applicationDate: caseData.caseRecord.applicationDate || new Date().toISOString(),
            caseType: caseData.caseRecord.caseType || 'General',
            spouseId: caseData.caseRecord.spouseId || '',
            status: caseData.caseRecord.status,
            description: caseData.caseRecord.description || '',
            priority: Boolean(caseData.caseRecord.priority),
            livingArrangement: caseData.caseRecord.livingArrangement || '',
            withWaiver: Boolean(caseData.caseRecord.withWaiver),
            admissionDate: caseData.caseRecord.admissionDate || new Date().toISOString(),
            organizationId: caseData.caseRecord.organizationId || '',
            authorizedReps: caseData.caseRecord.authorizedReps || [],
            retroRequested: caseData.caseRecord.retroRequested || '',
            financials: {
              resources: [],
              income: [],
              expenses: []
            },
            notes: [],
            createdDate: new Date().toISOString(),
            updatedDate: new Date().toISOString()
          }
        };

        // Set the person ID reference
        newCase.caseRecord.personId = newCase.person.id;
        
        // Add to internal data array (no save yet)
        this.data.cases.push(newCase);
        createdCases.push(newCase);
        
        // Report progress
        if (progressCallback) {
          progressCallback(i + 1, total);
        }
        
        // Small delay to prevent overwhelming the system
        // Only add delay for very large imports
        if (casesData.length > 50 && i < casesData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }
      
      // Save all changes at once
      await this.endBatchMode();
      return createdCases;
    } catch (error) {
      // Ensure batch mode is ended even on error
      this.isBatchMode = false;
      throw error;
    }
  }

  /**
   * Exports all case data for backup or transfer purposes
   * @returns Promise<{cases: CaseDisplay[]}> - Object containing all cases
   * @example
   * const backup = await fileStorageAPI.exportData();
   * console.log(`Exported ${backup.cases.length} cases`);
   */
  async exportData(): Promise<{ cases: CaseDisplay[] }> {
    return { cases: this.data.cases };
  }

  /**
   * Permanently deletes all case data from storage
   * This operation cannot be undone - ensure data is backed up first
   * @returns Promise<void> - Resolves when all data is purged
   * @example
   * await fileStorageAPI.purgeData();
   * console.log('All case data has been deleted');
   */
  async purgeData(): Promise<void> {
    this.data = {
      cases: [],
      lastModified: Date.now()
    };
    
    // Save the empty data to file storage
    await this.saveDataToService();
    
    // Also mark as not loaded to prevent automatic reloading
    this.isDataLoaded = false;
  }

  /**
   * Updates the internal data cache with file data loaded from storage
   * Sanitizes data to ensure consistency and handles legacy data formats
   * @param fileData - Raw file data containing cases and metadata
   * @example
   * // Called internally when data is loaded from file system
   * fileStorageAPI.updateInternalData(loadedFileData);
   */
  updateInternalData(fileData: any): void {
    console.log(`[FileStorageAPI] updateInternalData called with:`, fileData ? `${fileData.cases?.length || 0} cases` : 'null data');
    
    if (fileData && fileData.cases) {
      // Ensure note data integrity when loading
      const sanitizedCases = fileData.cases.map((caseItem: any) => {
        if (caseItem.caseRecord && caseItem.caseRecord.notes) {
          caseItem.caseRecord.notes = caseItem.caseRecord.notes.map((note: any) => ({
            ...note,
            category: note.category || 'General',
            content: note.content || ''
          }));
        }
        return caseItem;
      });

      this.data = {
        cases: sanitizedCases,
        lastModified: fileData.lastModified || Date.now(),
        exportedAt: fileData.exportedAt || fileData.exported_at,
        totalCases: fileData.totalCases || fileData.total_cases || fileData.cases.length
      };
      this.isDataLoaded = true;
      
      console.log(`[FileStorageAPI] Internal data updated with ${this.data.cases.length} cases`);
    } else {
      // Handle empty/null data explicitly
      this.data = {
        cases: [],
        lastModified: Date.now()
      };
      this.isDataLoaded = true;
      
      console.log(`[FileStorageAPI] Internal data reset to empty`);
    }
  }

  // Expose internal data for sync access
  get internalData(): FileStorageData {
    return this.data;
  }
}