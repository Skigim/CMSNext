/**
 * @fileoverview AVS Domain Module
 *
 * Exports AVS (Account Verification Service) parsing utilities.
 *
 * @module domain/avs
 */

export {
  KNOWN_ACCOUNT_TYPES,
  type ParsedAVSAccount,
  type MatchConfidence,
  type MatchResult,
  parseAccountBlock,
  parseAVSInput,
  parseAVSInputAsync,
  splitAVSBlocks,
  avsAccountToFinancialItem,
  avsAccountsToFinancialItems,
  findMatchingFinancialItem,
} from "./parser";
