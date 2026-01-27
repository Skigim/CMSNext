import { v4 as uuidv4 } from 'uuid';
import type { AmountHistoryEntry, CaseCategory, FinancialItem } from '../../types/case';
import type { FileStorageService, NormalizedFileData, StoredFinancialItem, StoredCase } from './FileStorageService';
import {
  createHistoryEntry,
  closePreviousOngoingEntry,
  getAmountForMonth,
} from '../../domain/financials';
import { readDataAndRequireCase } from '../serviceHelpers';

/**
 * Configuration for FinancialsService initialization.
 * @interface FinancialsServiceConfig
 */
interface FinancialsServiceConfig {
  /** File storage service for reading/writing financial data */
  fileStorage: FileStorageService;
}

/**
 * FinancialsService - Financial item operations and amount history management
 * 
 * This service handles all operations related to financial items (resources,
 * income, expenses) in the normalized v2.0 format. Financial items are stored
 * separately from cases with foreign key references.
 * 
 * ## Architecture
 * 
 * ```
 * FinancialsService
 *     ↓
 * FileStorageService (read/write operations)
 *     ↓
 * AutosaveFileService (file I/O)
 * ```
 * 
 * ## Data Format
 * 
 * Financial items are stored in a flat array with foreign keys:
 * 
 * ```typescript
 * {
 *   id: string,
 *   caseId: string,  // Foreign key to case
 *   category: 'resources' | 'income' | 'expenses',
 *   name: string,
 *   amount: number,
 *   amountHistory: AmountHistoryEntry[],  // Track changes over time
 *   frequency: string,
 *   verified: boolean,
 *   createdAt: string,
 *   updatedAt: string
 * }
 * ```
 * 
 * ## Core Responsibilities
 * 
 * ### CRUD Operations
 * - Add financial items to cases
 * - Update existing financial items
 * - Delete financial items
 * - Get items for a case (all or grouped by category)
 * 
 * ### Amount History Management
 * - Auto-create history entry when adding items with amounts
 * - Add new history entries for amount changes
 * - Update existing history entries
 * - Delete history entries
 * - Get amount for specific month
 * 
 * ### Data Integrity
 * - Verify case exists before adding items
 * - Update case timestamps when financials change
 * - Maintain item timestamps (createdAt, updatedAt)
 * 
 * ### Migration Support
 * - Migrate items without history to include initial entry
 * 
 * ## Pattern: Read → Modify → Write
 * 
 * All operations follow the stateless pattern:
 * 1. Read current data from file
 * 2. Modify data in memory
 * 3. Update related timestamps
 * 4. Write updated data back to file
 * 5. Return updated entity
 * 
 * No data is cached - file system is single source of truth.
 * 
 * @class FinancialsService
 * @see {@link FileStorageService} for underlying storage operations
 * @see {@link financialHistory} for amount history utilities
 */
export class FinancialsService {
  /** File storage service for data persistence */
  private fileStorage: FileStorageService;

  /**
   * Create a new FinancialsService instance.
   * 
   * @param {FinancialsServiceConfig} config - Configuration object
   * @param {FileStorageService} config.fileStorage - File storage service instance
   */
  constructor(config: FinancialsServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  /**
   * Get all financial items for a specific case.
   * 
   * Returns items with caseId and category foreign keys in normalized format.
   * Always reads fresh data from disk.
   * 
   * @param {string} caseId - The case ID to get financial items for
   * @returns {Promise<StoredFinancialItem[]>} Array of financial items for the case
   * 
   * @example
   * const items = await financialsService.getItemsForCase(caseId);
   * console.log(`Case has ${items.length} financial items`);
   */
  async getItemsForCase(caseId: string): Promise<StoredFinancialItem[]> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      return [];
    }
    return this.fileStorage.getFinancialsForCase(data, caseId);
  }

  /**
   * Get financial items for a case grouped by category.
   * 
   * Organizes items into three categories: resources, income, and expenses.
   * Useful for displaying financials in categorized views.
   * 
   * @param {string} caseId - The case ID to get financial items for
   * @returns {Promise<{resources: StoredFinancialItem[], income: StoredFinancialItem[], expenses: StoredFinancialItem[]}>}
   *   Object with financial items grouped by category
   * 
   * @example
   * const grouped = await financialsService.getItemsForCaseGrouped(caseId);
   * console.log(`Resources: ${grouped.resources.length}`);
   * console.log(`Income: ${grouped.income.length}`);
   * console.log(`Expenses: ${grouped.expenses.length}`);
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
   * Add a financial item to a case.
   * 
   * This method:
   * 1. Reads current data from file
   * 2. Verifies case exists
   * 3. Auto-creates amount history if amount provided but no history
   * 4. Creates new item with foreign keys (caseId, category)
   * 5. Adds to financials array
   * 6. Updates case timestamp
   * 7. Writes back to file
   * 8. Returns the created item
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * **Amount History:** If the item has an amount but no amountHistory is provided,
   * automatically creates a history entry starting from the first of the current month.
   * 
   * @param {string} caseId - The case ID to add the item to
   * @param {CaseCategory} category - The category ('resources', 'income', or 'expenses')
   * @param {Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>} itemData - The financial item data
   * @returns {Promise<StoredFinancialItem>} The created financial item with caseId and category
   * @throws {Error} If failed to read current data or case not found
   * 
   * @example
   * const item = await financialsService.addItem(caseId, 'resources', {
   *   name: "SNAP Benefits",
   *   amount: 500,
   *   frequency: "monthly",
   *   verified: true
   * });
   * // Auto-creates amount history entry starting from current month
   */
  async addItem(
    caseId: string,
    category: CaseCategory,
    itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StoredFinancialItem> {
    // Read and verify case exists
    const financialData = await readDataAndRequireCase(this.fileStorage, caseId);

    // Auto-create history entry if amount provided but no history
    let amountHistory = itemData.amountHistory;
    if (itemData.amount !== undefined && !amountHistory) {
      amountHistory = [createHistoryEntry(itemData.amount, undefined, {
        verificationStatus: itemData.verificationStatus,
        verificationSource: itemData.verificationSource,
      })];
    }

    // Create new item with foreign keys
    const timestamp = new Date().toISOString();
    const newItem: StoredFinancialItem = {
      ...itemData,
      amountHistory,
      id: uuidv4(),
      caseId,
      category,
      dateAdded: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Add to financials array
    const updatedFinancials = [...financialData.financials, newItem];

    // Touch case timestamp
    const updatedCases = this.fileStorage.touchCaseTimestamps(financialData.cases, [caseId]);

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...financialData,
      cases: updatedCases,
      financials: updatedFinancials,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    return newItem;
  }

  /**
   * Update a financial item in a case.
   * 
   * This method:
   * 1. Reads current data from file
   * 2. Verifies case and item exist
   * 3. Handles amount changes with automatic history management
   * 4. Updates item with provided fields
   * 5. Preserves ID, foreign keys, and creation timestamp
   * 6. Updates case timestamp
   * 7. Writes back to file
   * 8. Returns the updated item
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * **Amount History:** If the amount changes and no amountHistory update is provided,
   * automatically creates a new history entry and closes previous ongoing entries.
   * 
   * @param {string} caseId - The case ID
   * @param {CaseCategory} category - The category of the item
   * @param {string} itemId - The ID of the item to update
   * @param {Partial<FinancialItem>} updates - The fields to update
   * @returns {Promise<StoredFinancialItem>} The updated financial item
   * @throws {Error} If failed to read current data, case not found, or item not found
   * 
   * @example
   * const updated = await financialsService.updateItem(
   *   caseId,
   *   'resources',
   *   itemId,
   *   { amount: 600, verified: true }
   * );
   * // Auto-creates new history entry and closes previous ones
   */
  async updateItem(
    caseId: string,
    category: CaseCategory,
    itemId: string,
    updates: Partial<FinancialItem>,
  ): Promise<StoredFinancialItem> {
    // Read and verify case exists
    const financialData = await readDataAndRequireCase(this.fileStorage, caseId);

    // Find item to update
    const itemIndex = financialData.financials.findIndex(
      f => f.id === itemId && f.caseId === caseId && f.category === category
    );
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }

    const existingItem = financialData.financials[itemIndex];

    // Check if amount is changing and no explicit amountHistory update provided
    const isAmountChanging = 
      updates.amount !== undefined && 
      updates.amount !== existingItem.amount &&
      updates.amountHistory === undefined;

    let updatedAmountHistory = updates.amountHistory ?? existingItem.amountHistory;

    if (isAmountChanging && updates.amount !== undefined) {
      // Get verificationStatus from updates or existing item
      const verificationStatus = updates.verificationStatus ?? existingItem.verificationStatus;
      const verificationSource = updates.verificationSource ?? existingItem.verificationSource;
      
      // Auto-create a history entry for the new amount
      const newEntry = createHistoryEntry(updates.amount, undefined, {
        verificationStatus,
        verificationSource,
      });
      const existingHistory = existingItem.amountHistory ?? [];
      
      // Close any previous ongoing entries
      const closedHistory = closePreviousOngoingEntry(existingHistory, newEntry.startDate);
      
      updatedAmountHistory = [...closedHistory, newEntry];
    }

    // Update item
    const updatedItem: StoredFinancialItem = {
      ...existingItem,
      ...updates,
      amountHistory: updatedAmountHistory,
      id: itemId, // Preserve ID
      caseId, // Preserve foreign key
      category, // Preserve category
      createdAt: existingItem.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString()
    };

    // Update financials array
    const updatedFinancials = financialData.financials.map((f, index) =>
      index === itemIndex ? updatedItem : f
    );

    // Touch case timestamp
    const updatedCases = this.fileStorage.touchCaseTimestamps(financialData.cases, [caseId]);

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...financialData,
      cases: updatedCases,
      financials: updatedFinancials,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    return updatedItem;
  }

  /**
   * Delete a financial item from a case.
   * 
   * This method:
   * 1. Reads current data from file
   * 2. Verifies case and item exist
   * 3. Removes item from financials array
   * 4. Updates case timestamp
   * 5. Writes back to file
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * **Warning:** This operation is permanent and cannot be undone.
   * 
   * @param {string} caseId - The case ID
   * @param {CaseCategory} category - The category of the item
   * @param {string} itemId - The ID of the item to delete
   * @returns {Promise<void>}
   * @throws {Error} If failed to read current data, case not found, or item not found
   * 
   * @example
   * await financialsService.deleteItem(caseId, 'resources', itemId);
   * console.log('Financial item deleted');
   */
  async deleteItem(caseId: string, category: CaseCategory, itemId: string): Promise<void> {
    // Read and verify case exists
    const financialData = await readDataAndRequireCase(this.fileStorage, caseId);

    // Verify item exists
    const itemExists = financialData.financials.some(
      f => f.id === itemId && f.caseId === caseId && f.category === category
    );
    if (!itemExists) {
      throw new Error('Item not found');
    }

    // Remove from financials array
    const updatedFinancials = financialData.financials.filter(
      f => !(f.id === itemId && f.caseId === caseId && f.category === category)
    );

    // Touch case timestamp
    const updatedCases = this.fileStorage.touchCaseTimestamps(financialData.cases, [caseId]);

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...financialData,
      cases: updatedCases,
      financials: updatedFinancials,
    };

    await this.fileStorage.writeNormalizedData(updatedData);
  }

  /**
   * Get the case data for a financial item.
   * 
   * Helper method for backward compatibility.
   * Returns the full case object associated with a financial item.
   * 
   * @param {string} caseId - The case ID
   * @returns {Promise<StoredCase | null>} The case if found, null otherwise
   */
  async getCaseForItem(caseId: string): Promise<StoredCase | null> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      return null;
    }
    return this.fileStorage.getCaseById(data, caseId) ?? null;
  }

  /**
   * Add a new amount history entry to a financial item.
   * 
   * Amount history tracks changes in the item's amount over time.
   * This method automatically closes any previous ongoing entries
   * (entries with no endDate) to maintain data integrity.
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * @param {string} caseId - The case ID
   * @param {CaseCategory} category - The category of the item
   * @param {string} itemId - The ID of the financial item
   * @param {Omit<AmountHistoryEntry, 'id' | 'createdAt'>} entry - The history entry data
   * @returns {Promise<StoredFinancialItem>} The updated financial item with new history entry
   * @throws {Error} If failed to read current data, case not found, or item not found
   * 
   * @example
   * const updated = await financialsService.addAmountHistoryEntry(
   *   caseId,
   *   'resources',
   *   itemId,
   *   {
   *     amount: 700,
   *     startDate: '2024-01-01',
   *     notes: 'Benefit increase'
   *   }
   * );
   * // Previous ongoing entries are automatically closed
   */
  async addAmountHistoryEntry(
    caseId: string,
    category: CaseCategory,
    itemId: string,
    entry: Omit<AmountHistoryEntry, 'id' | 'createdAt'>
  ): Promise<StoredFinancialItem> {
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    const itemIndex = currentData.financials.findIndex(
      f => f.id === itemId && f.caseId === caseId && f.category === category
    );
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }

    const existingItem = currentData.financials[itemIndex];
    const existingHistory = existingItem.amountHistory ?? [];

    // Create new entry with ID and timestamp
    const newEntry: AmountHistoryEntry = {
      ...entry,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };

    // Close previous ongoing entries
    const closedHistory = closePreviousOngoingEntry(existingHistory, newEntry.startDate);
    const updatedHistory = [...closedHistory, newEntry];

    // Calculate current amount based on updated history
    const currentAmount = getAmountForMonth({ ...existingItem, amountHistory: updatedHistory });

    const updatedItem: StoredFinancialItem = {
      ...existingItem,
      amount: currentAmount,
      amountHistory: updatedHistory,
      updatedAt: new Date().toISOString(),
    };

    const updatedFinancials = currentData.financials.map((f, index) =>
      index === itemIndex ? updatedItem : f
    );

    const updatedCases = this.fileStorage.touchCaseTimestamps(currentData.cases, [caseId]);

    await this.fileStorage.writeNormalizedData({
      ...currentData,
      cases: updatedCases,
      financials: updatedFinancials,
    });

    return updatedItem;
  }

  /**
   * Update an existing amount history entry.
   * 
   * Modifies an existing history entry for a financial item.
   * Recalculates the current amount based on the updated history.
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * @param {string} caseId - The case ID
   * @param {CaseCategory} category - The category of the item
   * @param {string} itemId - The ID of the financial item
   * @param {string} entryId - The ID of the history entry to update
   * @param {Partial<Omit<AmountHistoryEntry, 'id' | 'createdAt'>>} updates - The fields to update
   * @returns {Promise<StoredFinancialItem>} The updated financial item
   * @throws {Error} If item or history entry not found
   * 
   * @example
   * const updated = await financialsService.updateAmountHistoryEntry(
   *   caseId,
   *   'resources',
   *   itemId,
   *   entryId,
   *   { amount: 750, notes: 'Corrected amount' }
   * );
   */
  async updateAmountHistoryEntry(
    caseId: string,
    category: CaseCategory,
    itemId: string,
    entryId: string,
    updates: Partial<Omit<AmountHistoryEntry, 'id' | 'createdAt'>>
  ): Promise<StoredFinancialItem> {
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    const itemIndex = currentData.financials.findIndex(
      f => f.id === itemId && f.caseId === caseId && f.category === category
    );
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }

    const existingItem = currentData.financials[itemIndex];
    const existingHistory = existingItem.amountHistory ?? [];

    const entryIndex = existingHistory.findIndex(e => e.id === entryId);
    if (entryIndex === -1) {
      throw new Error('History entry not found');
    }

    const existingEntry = existingHistory[entryIndex];
    const updatedEntry: AmountHistoryEntry = {
      ...existingEntry,
      ...updates,
      id: entryId, // Preserve ID
      createdAt: existingEntry.createdAt, // Preserve creation time
    };

    const updatedHistory = existingHistory.map((e, index) =>
      index === entryIndex ? updatedEntry : e
    );

    // Calculate current amount based on updated history
    const currentAmount = getAmountForMonth({ ...existingItem, amountHistory: updatedHistory });

    const updatedItem: StoredFinancialItem = {
      ...existingItem,
      amount: currentAmount,
      amountHistory: updatedHistory,
      updatedAt: new Date().toISOString(),
    };

    const updatedFinancials = currentData.financials.map((f, index) =>
      index === itemIndex ? updatedItem : f
    );

    const updatedCases = this.fileStorage.touchCaseTimestamps(currentData.cases, [caseId]);

    await this.fileStorage.writeNormalizedData({
      ...currentData,
      cases: updatedCases,
      financials: updatedFinancials,
    });

    return updatedItem;
  }

  /**
   * Delete an amount history entry from a financial item.
   * 
   * Removes a history entry and recalculates the current amount.
   * If no history entries remain after deletion, clears the amountHistory field.
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * **Warning:** This operation is permanent and cannot be undone.
   * 
   * @param {string} caseId - The case ID
   * @param {CaseCategory} category - The category of the item
   * @param {string} itemId - The ID of the financial item
   * @param {string} entryId - The ID of the history entry to delete
   * @returns {Promise<StoredFinancialItem>} The updated financial item
   * @throws {Error} If item or history entry not found
   * 
   * @example
   * const updated = await financialsService.deleteAmountHistoryEntry(
   *   caseId,
   *   'resources',
   *   itemId,
   *   entryId
   * );
   * console.log('History entry deleted, amount recalculated');
   */
  async deleteAmountHistoryEntry(
    caseId: string,
    category: CaseCategory,
    itemId: string,
    entryId: string
  ): Promise<StoredFinancialItem> {
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    const itemIndex = currentData.financials.findIndex(
      f => f.id === itemId && f.caseId === caseId && f.category === category
    );
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }

    const existingItem = currentData.financials[itemIndex];
    const existingHistory = existingItem.amountHistory ?? [];

    const entryExists = existingHistory.some(e => e.id === entryId);
    if (!entryExists) {
      throw new Error('History entry not found');
    }

    const updatedHistory = existingHistory.filter(e => e.id !== entryId);

    // Calculate current amount based on updated history (or fall back to existing amount)
    const currentAmount = updatedHistory.length > 0
      ? getAmountForMonth({ ...existingItem, amountHistory: updatedHistory })
      : existingItem.amount;

    const updatedItem: StoredFinancialItem = {
      ...existingItem,
      amount: currentAmount,
      amountHistory: updatedHistory.length > 0 ? updatedHistory : undefined,
      updatedAt: new Date().toISOString(),
    };

    const updatedFinancials = currentData.financials.map((f, index) =>
      index === itemIndex ? updatedItem : f
    );

    const updatedCases = this.fileStorage.touchCaseTimestamps(currentData.cases, [caseId]);

    await this.fileStorage.writeNormalizedData({
      ...currentData,
      cases: updatedCases,
      financials: updatedFinancials,
    });

    return updatedItem;
  }

  /**
   * Migrate financial items without amount history to include initial entries.
   * 
   * This migration method:
   * 1. Finds items that have an amount but no amountHistory
   * 2. Creates history entries from existing dateAdded or createdAt timestamps
   * 3. Normalizes ISO timestamp dates to YYYY-MM-DD format
   * 4. Updates all affected items in a single write operation
   * 
   * **Use Case:** Run once after upgrading from a version that didn't support amount history.
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * For backward compatibility, items that have a dateAdded but no amountHistory
   * will get a history entry created using their current amount and dateAdded.
   * 
   * This ensures all items have at least one history entry for consistent date display.
   * 
   * Also normalizes any ISO timestamp dates in existing history to YYYY-MM-DD format.
   * 
   * @returns {Promise<number>} Number of items migrated
   * 
   * @example
   * const migrated = await financialsService.migrateItemsWithoutHistory();
   * console.log(`Migrated ${migrated} financial items`);
   */
  async migrateItemsWithoutHistory(): Promise<number> {
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      return 0;
    }

    let migratedCount = 0;
    const updatedFinancials = currentData.financials.map(item => {
      // Check if item has history that needs date format normalization
      if (item.amountHistory && item.amountHistory.length > 0) {
        const needsNormalization = item.amountHistory.some(
          e => e.startDate && e.startDate.includes('T')
        );
        
        if (needsNormalization) {
          migratedCount++;
          return {
            ...item,
            amountHistory: item.amountHistory.map(e => ({
              ...e,
              startDate: this.normalizeToDateOnly(e.startDate),
              endDate: e.endDate ? this.normalizeToDateOnly(e.endDate) : e.endDate,
            })),
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      }

      // Skip if no amount to record
      if (item.amount === undefined) {
        return item;
      }

      // Create history entry from existing dateAdded or createdAt
      const startDate = item.dateAdded || item.createdAt;
      if (!startDate) {
        // No date available, create with current first of month
        const entry = createHistoryEntry(item.amount);
        migratedCount++;
        return {
          ...item,
          amountHistory: [entry],
          updatedAt: new Date().toISOString(),
        };
      }

      // Parse the date and format as YYYY-MM-DD (first of month)
      const date = new Date(startDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const formattedDate = `${year}-${month}-01`;
      
      const entry: AmountHistoryEntry = {
        id: `migrated-${item.id}`,
        amount: item.amount,
        startDate: formattedDate,
        endDate: null,
        createdAt: new Date().toISOString(),
      };

      migratedCount++;
      return {
        ...item,
        amountHistory: [entry],
        updatedAt: new Date().toISOString(),
      };
    });

    if (migratedCount > 0) {
      await this.fileStorage.writeNormalizedData({
        ...currentData,
        financials: updatedFinancials,
      });
    }

    return migratedCount;
  }

  /**
   * Normalize an ISO timestamp or date string to YYYY-MM-DD format
   */
  private normalizeToDateOnly(dateStr: string): string {
    if (!dateStr.includes('T')) {
      return dateStr; // Already in date-only format
    }
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
