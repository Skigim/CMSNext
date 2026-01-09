/**
 * @fileoverview AVS Domain Module
 *
 * Exports AVS (Account Verification Service) parsing utilities.
 *
 * @module domain/avs
 */

export {
  KNOWN_ACCOUNT_TYPES,
  type KnownAccountType,
  type ParsedAVSAccount,
  parseAccountBlock,
  parseAVSInput,
  avsAccountToFinancialItem,
  avsAccountsToFinancialItems,
  findMatchingFinancialItem,
} from "./parser";
