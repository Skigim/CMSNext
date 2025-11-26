import { v4 as uuidv4 } from 'uuid';
import type { CaseCategory, FinancialItem } from '../../types/case';
import type { FileStorageService, NormalizedFileData, StoredFinancialItem, StoredCase } from './FileStorageService';

interface FinancialsServiceConfig {
  fileStorage: FileStorageService;
}

/**
 * FinancialsService - Handles all financial item CRUD operations
 * 
 * Works directly with normalized v2.0 data format:
 * - Financial items stored as flat array with caseId + category foreign keys
 * - No nested case structures
 * 
 * Responsibilities:
 * - Add financial items (resources, income, expenses) to cases
 * - Update existing financial items
 * - Delete financial items
 * - Get financial items for a case
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
   * Get all financial items for a case
   */
  async getItemsForCase(caseId: string): Promise<StoredFinancialItem[]> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      return [];
    }
    return this.fileStorage.getFinancialsForCase(data, caseId);
  }

  /**
   * Get financial items for a case grouped by category
   */
  async getItemsForCaseGrouped(caseId: string): Promise<{
    resources: StoredFinancialItem[];
    income: StoredFinancialItem[];
    expenses: StoredFinancialItem[];
  }> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      return { resources: [], income: [], expenses: [] };
    }
    return this.fileStorage.getFinancialsForCaseGrouped(data, caseId);
  }

  /**
   * Add financial item to a case
   * Pattern: read → modify → write
   */
  async addItem(
    caseId: string,
    category: CaseCategory,
    itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StoredFinancialItem> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Verify case exists
    const caseExists = currentData.cases.some(c => c.id === caseId);
    if (!caseExists) {
      throw new Error('Case not found');
    }

    // Create new item with foreign keys
    const timestamp = new Date().toISOString();
    const newItem: StoredFinancialItem = {
      ...itemData,
      id: uuidv4(),
      caseId,
      category,
      dateAdded: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Add to financials array
    const updatedFinancials = [...currentData.financials, newItem];

    // Touch case timestamp
    const updatedCases = this.fileStorage.touchCaseTimestamps(currentData.cases, [caseId]);

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: updatedCases,
      financials: updatedFinancials,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    return newItem;
  }

  /**
   * Update financial item
   * Pattern: read → modify → write
   */
  async updateItem(
    caseId: string,
    category: CaseCategory,
    itemId: string,
    updates: Partial<FinancialItem>,
  ): Promise<StoredFinancialItem> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Verify case exists first
    const caseExists = currentData.cases.some(c => c.id === caseId);
    if (!caseExists) {
      throw new Error('Case not found');
    }

    // Find item to update
    const itemIndex = currentData.financials.findIndex(
      f => f.id === itemId && f.caseId === caseId && f.category === category
    );
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }

    const existingItem = currentData.financials[itemIndex];

    // Update item
    const updatedItem: StoredFinancialItem = {
      ...existingItem,
      ...updates,
      id: itemId, // Preserve ID
      caseId, // Preserve foreign key
      category, // Preserve category
      createdAt: existingItem.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString()
    };

    // Update financials array
    const updatedFinancials = currentData.financials.map((f, index) =>
      index === itemIndex ? updatedItem : f
    );

    // Touch case timestamp
    const updatedCases = this.fileStorage.touchCaseTimestamps(currentData.cases, [caseId]);

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: updatedCases,
      financials: updatedFinancials,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    return updatedItem;
  }

  /**
   * Delete financial item
   * Pattern: read → modify → write
   */
  async deleteItem(caseId: string, category: CaseCategory, itemId: string): Promise<void> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Verify case exists first
    const caseExists = currentData.cases.some(c => c.id === caseId);
    if (!caseExists) {
      throw new Error('Case not found');
    }

    // Verify item exists
    const itemExists = currentData.financials.some(
      f => f.id === itemId && f.caseId === caseId && f.category === category
    );
    if (!itemExists) {
      throw new Error('Item not found');
    }

    // Remove from financials array
    const updatedFinancials = currentData.financials.filter(
      f => !(f.id === itemId && f.caseId === caseId && f.category === category)
    );

    // Touch case timestamp
    const updatedCases = this.fileStorage.touchCaseTimestamps(currentData.cases, [caseId]);

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: updatedCases,
      financials: updatedFinancials,
    };

    await this.fileStorage.writeNormalizedData(updatedData);
  }

  /**
   * Get the case data for a financial item (for backward compatibility)
   */
  async getCaseForItem(caseId: string): Promise<StoredCase | null> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      return null;
    }
    return this.fileStorage.getCaseById(data, caseId) ?? null;
  }
}
