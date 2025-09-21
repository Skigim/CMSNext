import { CaseDisplay, CaseCategory, FinancialItem, NewPersonData, NewCaseRecordData, NewNoteData } from "../types/case";
import { v4 as uuidv4 } from 'uuid';
import AutosaveFileService from './AutosaveFileService';
import { transformImportedData } from './dataTransform';

interface DataManagerConfig {
  fileService: AutosaveFileService;
}

interface FileData {
  cases: CaseDisplay[];
  exported_at: string;
  total_cases: number;
}

/**
 * Stateless Data Manager
 * 
 * Core Principles:
 * - NO data storage/caching anywhere
 * - File system is the single source of truth
 * - All operations: read file → modify → write file
 * - Always returns fresh data from file system
 */
export class DataManager {
  private fileService: AutosaveFileService;

  constructor(config: DataManagerConfig) {
    this.fileService = config.fileService;
  }

  // =============================================================================
  // CORE FILE OPERATIONS (Private)
  // =============================================================================

  /**
   * Read current data from file system
   * Returns null if no file exists or error occurs
   */
  private async readFileData(): Promise<FileData | null> {
    try {
      const rawData = await this.fileService.readFile();
      
      if (!rawData) {
        // No file exists yet - return empty structure
        return {
          cases: [],
          exported_at: new Date().toISOString(),
          total_cases: 0
        };
      }

      // Handle different data formats
      let cases: CaseDisplay[] = [];
      
      if (rawData.cases && Array.isArray(rawData.cases)) {
        // Already in the correct format
        cases = rawData.cases;
      } else if (rawData.people && rawData.caseRecords) {
        // Raw format - transform using the data transformer
        console.log('[DataManager] Transforming raw data format (people + caseRecords) to cases');
        cases = transformImportedData(rawData);
      } else {
        // Try to transform whatever format this is
        cases = transformImportedData(rawData);
      }

      return {
        cases: cases,
        exported_at: rawData.exported_at || rawData.exportedAt || new Date().toISOString(),
        total_cases: cases.length
      };
    } catch (error) {
      console.error('Failed to read file data:', error);
      throw new Error(`Failed to read case data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Write data to file system
   * Throws error if write fails
   */
  private async writeFileData(data: FileData): Promise<void> {
    try {
      // Ensure data integrity before writing
      const validatedData = {
        ...data,
        exported_at: new Date().toISOString(),
        total_cases: data.cases.length,
        cases: data.cases.map(caseItem => ({
          ...caseItem,
          updatedAt: new Date().toISOString()
        }))
      };

      const success = await this.fileService.writeFile(validatedData);
      
      if (!success) {
        throw new Error('File write operation failed');
      }
    } catch (error) {
      console.error('Failed to write file data:', error);
      throw new Error(`Failed to save case data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================================================
  // PUBLIC API - READ OPERATIONS
  // =============================================================================

  /**
   * Get all cases (always reads fresh from file)
   */
  async getAllCases(): Promise<CaseDisplay[]> {
    const data = await this.readFileData();
    return data ? data.cases : [];
  }

  /**
   * Get a specific case by ID (always reads fresh from file)
   */
  async getCaseById(caseId: string): Promise<CaseDisplay | null> {
    const data = await this.readFileData();
    if (!data) return null;
    
    const caseItem = data.cases.find(c => c.id === caseId);
    return caseItem || null;
  }

  /**
   * Get cases count (always reads fresh from file)
   */
  async getCasesCount(): Promise<number> {
    const data = await this.readFileData();
    return data ? data.cases.length : 0;
  }

  // =============================================================================
  // PUBLIC API - WRITE OPERATIONS
  // =============================================================================

  /**
   * Create a new complete case
   * Pattern: read → modify → write
   */
  async createCompleteCase(caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Create new case
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

    // Modify data
    const updatedData: FileData = {
      ...currentData,
      cases: [...currentData.cases, newCase]
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return newCase;
  }

  /**
   * Update an existing complete case
   * Pattern: read → modify → write
   */
  async updateCompleteCase(caseId: string, caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const existingCase = currentData.cases[caseIndex];

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
      // Preserve existing financials and notes
      financials: existingCase.caseRecord.financials,
      notes: existingCase.caseRecord.notes,
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

    // Modify data
    const updatedData: FileData = {
      ...currentData,
      cases: currentData.cases.map((c, index) => 
        index === caseIndex ? updatedCase : c
      )
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return updatedCase;
  }

  /**
   * Delete a case
   * Pattern: read → modify → write
   */
  async deleteCase(caseId: string): Promise<void> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Check if case exists
    const caseExists = currentData.cases.some(c => c.id === caseId);
    if (!caseExists) {
      throw new Error('Case not found');
    }

    // Modify data (remove case)
    const updatedData: FileData = {
      ...currentData,
      cases: currentData.cases.filter(c => c.id !== caseId)
    };

    // Write back to file
    await this.writeFileData(updatedData);
  }

  // =============================================================================
  // FINANCIAL ITEM OPERATIONS
  // =============================================================================

  /**
   * Add financial item to a case
   * Pattern: read → modify → write
   */
  async addItem(caseId: string, category: CaseCategory, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Create new item
    const newItem: FinancialItem = {
      ...itemData,
      id: uuidv4(),
      dateAdded: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const updatedCase: CaseDisplay = {
      ...targetCase,
      updatedAt: new Date().toISOString(),
      caseRecord: {
        ...targetCase.caseRecord,
        financials: {
          ...targetCase.caseRecord.financials,
          [category]: [...targetCase.caseRecord.financials[category], newItem]
        },
        updatedDate: new Date().toISOString()
      }
    };

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: currentData.cases.map((c, index) => 
        index === caseIndex ? updatedCase : c
      )
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return updatedCase;
  }

  /**
   * Update financial item in a case
   * Pattern: read → modify → write
   */
  async updateItem(caseId: string, category: CaseCategory, itemId: string, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Find item to update
    const itemIndex = targetCase.caseRecord.financials[category].findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }

    const existingItem = targetCase.caseRecord.financials[category][itemIndex];

    // Update item
    const updatedItem: FinancialItem = {
      ...existingItem,
      ...itemData,
      id: itemId, // Preserve ID
      createdAt: existingItem.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const updatedCase: CaseDisplay = {
      ...targetCase,
      updatedAt: new Date().toISOString(),
      caseRecord: {
        ...targetCase.caseRecord,
        financials: {
          ...targetCase.caseRecord.financials,
          [category]: targetCase.caseRecord.financials[category].map((item, index) =>
            index === itemIndex ? updatedItem : item
          )
        },
        updatedDate: new Date().toISOString()
      }
    };

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: currentData.cases.map((c, index) => 
        index === caseIndex ? updatedCase : c
      )
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return updatedCase;
  }

  /**
   * Delete financial item from a case
   * Pattern: read → modify → write
   */
  async deleteItem(caseId: string, category: CaseCategory, itemId: string): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Check if item exists
    const itemExists = targetCase.caseRecord.financials[category].some(item => item.id === itemId);
    if (!itemExists) {
      throw new Error('Item not found');
    }

    // Modify case data
    const updatedCase: CaseDisplay = {
      ...targetCase,
      updatedAt: new Date().toISOString(),
      caseRecord: {
        ...targetCase.caseRecord,
        financials: {
          ...targetCase.caseRecord.financials,
          [category]: targetCase.caseRecord.financials[category].filter(item => item.id !== itemId)
        },
        updatedDate: new Date().toISOString()
      }
    };

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: currentData.cases.map((c, index) => 
        index === caseIndex ? updatedCase : c
      )
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return updatedCase;
  }

  // =============================================================================
  // NOTE OPERATIONS
  // =============================================================================

  /**
   * Add note to a case
   * Pattern: read → modify → write
   */
  async addNote(caseId: string, noteData: NewNoteData): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Create new note
    const newNote = {
      id: uuidv4(),
      category: noteData.category || 'General',
      content: noteData.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const updatedCase: CaseDisplay = {
      ...targetCase,
      updatedAt: new Date().toISOString(),
      caseRecord: {
        ...targetCase.caseRecord,
        notes: [...(targetCase.caseRecord.notes || []), newNote],
        updatedDate: new Date().toISOString()
      }
    };

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: currentData.cases.map((c, index) => 
        index === caseIndex ? updatedCase : c
      )
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return updatedCase;
  }

  /**
   * Update note in a case
   * Pattern: read → modify → write
   */
  async updateNote(caseId: string, noteId: string, noteData: NewNoteData): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Find note to update
    const noteIndex = (targetCase.caseRecord.notes || []).findIndex(note => note.id === noteId);
    if (noteIndex === -1) {
      throw new Error('Note not found');
    }

    const existingNote = targetCase.caseRecord.notes![noteIndex];

    // Update note
    const updatedNote = {
      ...existingNote,
      category: noteData.category || existingNote.category,
      content: noteData.content,
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const updatedCase: CaseDisplay = {
      ...targetCase,
      updatedAt: new Date().toISOString(),
      caseRecord: {
        ...targetCase.caseRecord,
        notes: (targetCase.caseRecord.notes || []).map((note, index) =>
          index === noteIndex ? updatedNote : note
        ),
        updatedDate: new Date().toISOString()
      }
    };

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: currentData.cases.map((c, index) => 
        index === caseIndex ? updatedCase : c
      )
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return updatedCase;
  }

  /**
   * Delete note from a case
   * Pattern: read → modify → write
   */
  async deleteNote(caseId: string, noteId: string): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Check if note exists
    const noteExists = (targetCase.caseRecord.notes || []).some(note => note.id === noteId);
    if (!noteExists) {
      throw new Error('Note not found');
    }

    // Modify case data
    const updatedCase: CaseDisplay = {
      ...targetCase,
      updatedAt: new Date().toISOString(),
      caseRecord: {
        ...targetCase.caseRecord,
        notes: (targetCase.caseRecord.notes || []).filter(note => note.id !== noteId),
        updatedDate: new Date().toISOString()
      }
    };

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: currentData.cases.map((c, index) => 
        index === caseIndex ? updatedCase : c
      )
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return updatedCase;
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Import multiple cases at once
   * Pattern: read → modify → write (single operation)
   */
  async importCases(cases: CaseDisplay[]): Promise<void> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Validate and ensure unique IDs
    const validatedCases = cases.map(caseItem => ({
      ...caseItem,
      id: caseItem.id || uuidv4(),
      updatedAt: new Date().toISOString(),
      caseRecord: {
        ...caseItem.caseRecord,
        updatedDate: new Date().toISOString()
      }
    }));

    // Modify data (append new cases)
    const updatedData: FileData = {
      ...currentData,
      cases: [...currentData.cases, ...validatedCases]
    };

    // Write back to file
    await this.writeFileData(updatedData);
  }

  /**
   * Clear all data
   * Pattern: write empty structure
   */
  async clearAllData(): Promise<void> {
    const emptyData: FileData = {
      cases: [],
      exported_at: new Date().toISOString(),
      total_cases: 0
    };

    await this.writeFileData(emptyData);
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Check if file service is available and connected
   */
  isConnected(): boolean {
    return this.fileService.getStatus().permissionStatus === 'granted';
  }

  /**
   * Get file service status
   */
  getStatus() {
    return this.fileService.getStatus();
  }
}

export default DataManager;