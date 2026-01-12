/**
 * Error Utilities
 * ===============
 * Shared utilities for consistent error handling across the codebase.
 */

/**
 * Extract a string message from an unknown error.
 * 
 * This utility provides consistent error message extraction throughout
 * the codebase, replacing inline ternary checks like:
 * `error instanceof Error ? error.message : String(error)`
 * 
 * @param {unknown} error - The error to extract a message from
 * @returns {string} The error message string
 * 
 * @example
 * try {
 *   await someOperation();
 * } catch (error) {
 *   logger.error('Operation failed', { error: extractErrorMessage(error) });
 * }
 */
export function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
