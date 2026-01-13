/**
 * Service Helpers
 * ================
 * Shared helper functions for service layer operations.
 * 
 * These helpers abstract common patterns like "Read → Verify → Throw"
 * to eliminate code duplication across services.
 */

import type { FileStorageService, NormalizedFileData, StoredCase } from './services/FileStorageService';

/**
 * Result of reading and verifying case data.
 * 
 * @interface VerifiedCaseResult
 */
export interface VerifiedCaseResult {
  /** The full normalized file data */
  data: NormalizedFileData;
  /** Index of the target case in the cases array */
  caseIndex: number;
  /** The target case object */
  targetCase: StoredCase;
}

/**
 * Read file data and verify that a case exists.
 * 
 * This helper abstracts the common pattern:
 * 1. Read current data from file
 * 2. Throw if read fails
 * 3. Find case by ID
 * 4. Throw if case not found
 * 5. Return data, index, and case
 * 
 * @param {FileStorageService} fileStorage - The file storage service instance
 * @param {string} caseId - The case ID to find and verify
 * @returns {Promise<VerifiedCaseResult>} The data, case index, and target case
 * @throws {Error} If failed to read data or case not found
 * 
 * @example
 * ```typescript
 * const { data, caseIndex, targetCase } = await readDataAndVerifyCase(
 *   this.fileStorage,
 *   caseId
 * );
 * // Now you can safely work with the data and case
 * ```
 */
export async function readDataAndVerifyCase(
  fileStorage: FileStorageService,
  caseId: string
): Promise<VerifiedCaseResult> {
  const data = await fileStorage.readFileData();
  if (!data) {
    throw new Error('Failed to read current data');
  }

  const caseIndex = data.cases.findIndex(c => c.id === caseId);
  if (caseIndex === -1) {
    throw new Error('Case not found');
  }

  const targetCase = data.cases[caseIndex];

  return { data, caseIndex, targetCase };
}

/**
 * Result of reading and verifying case exists (without index).
 * 
 * Use this when you only need to confirm the case exists but
 * don't need the case index for array operations.
 * 
 * @interface VerifiedCaseExistsResult
 */
export interface VerifiedCaseExistsResult {
  /** The full normalized file data */
  data: NormalizedFileData;
  /** The target case object */
  targetCase: StoredCase;
}

/**
 * Read file data and verify that a case exists (simple version).
 * 
 * Similar to `readDataAndVerifyCase` but uses `find` instead of `findIndex`.
 * Use this when you don't need to modify the case in place.
 * 
 * @param {FileStorageService} fileStorage - The file storage service instance
 * @param {string} caseId - The case ID to find and verify
 * @returns {Promise<VerifiedCaseExistsResult>} The data and target case
 * @throws {Error} If failed to read data or case not found
 */
export async function readDataAndFindCase(
  fileStorage: FileStorageService,
  caseId: string
): Promise<VerifiedCaseExistsResult> {
  const data = await fileStorage.readFileData();
  if (!data) {
    throw new Error('Failed to read current data');
  }

  const targetCase = data.cases.find(c => c.id === caseId);
  if (!targetCase) {
    throw new Error('Case not found');
  }

  return { data, targetCase };
}

/**
 * Read file data and verify case exists (boolean check only).
 * 
 * Use this when you need the data but only need to confirm the case exists,
 * without needing the case object itself.
 * 
 * @param {FileStorageService} fileStorage - The file storage service instance
 * @param {string} caseId - The case ID to verify exists
 * @returns {Promise<NormalizedFileData>} The normalized file data
 * @throws {Error} If failed to read data or case not found
 */
export async function readDataAndRequireCase(
  fileStorage: FileStorageService,
  caseId: string
): Promise<NormalizedFileData> {
  const data = await fileStorage.readFileData();
  if (!data) {
    throw new Error('Failed to read current data');
  }

  const caseExists = data.cases.some(c => c.id === caseId);
  if (!caseExists) {
    throw new Error('Case not found');
  }

  return data;
}
