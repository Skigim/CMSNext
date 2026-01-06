/**
 * Domain Layer: Financials Module
 *
 * Pure business logic for financial calculations and validation.
 * No I/O, no React, no side effects.
 *
 * @module domain/financials
 */

export {
  validateFinancialItem,
  type FinancialValidationResult,
  type FinancialItemInput,
} from "./validation";

export {
  calculateCategoryTotal,
  calculateFinancialTotals,
  type CaseCategory,
} from "./calculations";
