import { v4 as uuidv4 } from 'uuid';
import type { CaseDisplay, CaseCategory, FinancialItem } from '../../types/case';
import type { FileStorageService, FileData } from './FileStorageService';

interface FinancialsServiceConfig {
  fileStorage: FileStorageService;
}

/**
 * FinancialsService - Handles all financial item CRUD operations for cases
 * 
 * Responsibilities:
 * - Add financial items (resources, income, expenses) to cases
 * - Update existing financial items
 * - Delete financial items
 * - Maintain financial item timestamps and metadata
 * - Touch case timestamps on financial changes
 * 
 * Pattern: read → modify → write (file system is single source of truth)
 */
export class FinancialsService {
  private fileStorage: FileStorageService;

  constructor(config: FinancialsServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  /**
   * Add financial item to a case
   * Pattern: read → modify → write
   */
  async addItem(
    caseId: string,
    category: CaseCategory,
    itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Ensure caseRecord exists
    if (!targetCase.caseRecord) {
      throw new Error('Case record is missing - data integrity issue. Please reload the data.');
    }

    // Create new item
    const newItem: FinancialItem = {
      ...itemData,
      id: uuidv4(),
      dateAdded: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const caseWithNewItem: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        financials: {
          ...targetCase.caseRecord.financials,
          [category]: [...targetCase.caseRecord.financials[category], newItem],
        },
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithNewItem : c,
    );

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.fileStorage.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Update financial item in a case
   * Pattern: read → modify → write
   */
  async updateItem(
    caseId: string,
    category: CaseCategory,
    itemId: string,
    updatedItem: Partial<FinancialItem>,
  ): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Ensure caseRecord exists
    if (!targetCase.caseRecord) {
      throw new Error('Case record is missing - data integrity issue. Please reload the data.');
    }

    // Find item to update
    const itemIndex = targetCase.caseRecord.financials[category].findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }

    const existingItem = targetCase.caseRecord.financials[category][itemIndex];

    // Update item
    const updatedItemData: FinancialItem = {
      ...existingItem,
      ...updatedItem,
      id: itemId, // Preserve ID
      createdAt: existingItem.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const caseWithUpdatedItem: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        financials: {
          ...targetCase.caseRecord.financials,
          [category]: targetCase.caseRecord.financials[category].map((item, index) =>
            index === itemIndex ? updatedItemData : item,
          ),
        },
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithUpdatedItem : c,
    );

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.fileStorage.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Delete financial item from a case
   * Pattern: read → modify → write
   */
  async deleteItem(caseId: string, category: CaseCategory, itemId: string): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Ensure caseRecord exists
    if (!targetCase.caseRecord) {
      throw new Error('Case record is missing - data integrity issue. Please reload the data.');
    }

    // Check if item exists
    const itemExists = targetCase.caseRecord.financials[category].some(item => item.id === itemId);
    if (!itemExists) {
      throw new Error('Item not found');
    }

    // Modify case data
    const caseWithItemRemoved: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        financials: {
          ...targetCase.caseRecord.financials,
          [category]: targetCase.caseRecord.financials[category].filter(item => item.id !== itemId),
        },
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithItemRemoved : c,
    );

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.fileStorage.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }
}
