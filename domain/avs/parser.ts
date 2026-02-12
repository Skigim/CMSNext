/**
 * AVS (Account Verification Service) Parser
 *
 * Parses account block data from AVS paste input and converts to financial resource items.
 *
 * Expected input format:
 * ```
 * Owner Name; Co-owner Name ACCOUNT_TYPE
 * Bank Name - (AccountNumber)
 * Address Line 1
 * Address Line 2
 * Balance as of MM/DD/YYYY - $XX,XXX.XX
 * Refresh Date: MM/DD/YYYY
 * ```
 *
 * @module domain/avs/parser
 */

import type { FinancialItem } from "@/types/case";

/**
 * Yield control back to the main thread so the browser can handle user
 * interactions, paint, etc.  Uses `requestIdleCallback` when available
 * (most browsers) and falls back to `setTimeout(0)` in test / SSR
 * environments.
 */
function yieldToMain(): Promise<void> {
  return new Promise<void>((resolve) => {
    if ("requestIdleCallback" in globalThis) {
      (globalThis as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
        .requestIdleCallback(() => resolve(), { timeout: 100 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Known account types that can appear at the end of the first line
 */
export const KNOWN_ACCOUNT_TYPES = [
  "CHECKING",
  "SAVINGS",
  "MONEY MARKET",
  "CD",
  "CERTIFICATE OF DEPOSIT",
  "IRA",
  "ROTH IRA",
  "401K",
  "401(K)",
  "BROKERAGE",
  "INVESTMENT",
  "PENSION",
  "ANNUITY",
  "LIFE INSURANCE",
  "MUTUAL FUND",
  "TRUST",
  // With "Account" suffix (common bank format)
  "CHECKING ACCOUNT",
  "SAVINGS ACCOUNT",
  "MONEY MARKET ACCOUNT",
] as const;

/**
 * Represents a parsed AVS account block
 */
export interface ParsedAVSAccount {
  /** Account owner(s), comma-separated if multiple */
  accountOwner: string;
  /** Type of account (e.g., CHECKING, SAVINGS) */
  accountType: string;
  /** Name of the financial institution */
  bankName: string;
  /** Last 4 digits of account number */
  accountNumber: string;
  /** Institution address */
  address: string;
  /** Current balance as string (includes formatting) */
  balance: string;
  /** Parsed numeric balance */
  balanceAmount: number;
  /** Date when data was last refreshed */
  refreshDate: string;
}

/**
 * Parse a balance string like "$1,234.56" or "N/A" to a number
 */
function parseBalance(balanceStr: string): number {
  if (!balanceStr || balanceStr === "N/A") {
    return 0;
  }
  // Remove currency symbols, commas, and whitespace
  const cleaned = balanceStr.replaceAll(/[$,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/** Sort known types longest-first so "CHECKING ACCOUNT" matches before "CHECKING". */
const SORTED_ACCOUNT_TYPES = [...KNOWN_ACCOUNT_TYPES].sort((a, b) => b.length - a.length);

/** Extract account type and owner(s) from the first line of an account block. */
function extractAccountTypeAndOwners(rawLine: string): { accountType: string; owners: string } {
  let firstLine = rawLine.trim();
  if (firstLine.toUpperCase().startsWith("ACCOUNT OWNER:")) {
    firstLine = firstLine.slice("Account Owner:".length).trim();
  }

  for (const type of SORTED_ACCOUNT_TYPES) {
    if (firstLine.toUpperCase().endsWith(type.toUpperCase())) {
      return { accountType: type, owners: firstLine.slice(0, -type.length).trim() };
    }
  }
  return { accountType: "N/A", owners: firstLine };
}

/** Collect address lines and locate the balance line index. */
function collectAddressAndBalance(lines: string[], startIndex: number): { address: string; balanceLineIndex: number } {
  const addressLines: string[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes("balance as of")) {
      return { address: addressLines.join(" "), balanceLineIndex: i };
    }
    addressLines.push(lines[i].trim());
  }
  return { address: addressLines.join(" "), balanceLineIndex: -1 };
}

/** Mask an account number to its last 4 digits. */
function maskAccountNumber(raw: string): string {
  if (raw === "N/A" || raw.length <= 4) return raw;
  return raw.slice(-4);
}

/**
 * Parse a single account block from AVS data
 *
 * @param block - A single account block text
 * @returns Parsed account data or null if parsing fails
 */
export function parseAccountBlock(block: string): ParsedAVSAccount | null {
  const lines = block.split("\n").filter((line) => line.trim() !== "");
  if (lines.length < 2) return null;

  const { accountType, owners } = extractAccountTypeAndOwners(lines[0]);

  const ownerList = owners
    .split(";")
    .map((o) => o.trim())
    .filter((o) => o.length > 0)
    .join(", ");

  const bankLine = lines[1] || "";
  const bankNameMatch = bankLine.match(/([^\n]+) - \(/);
  const accountNumberMatch = bankLine.match(/ - \((\d+)\)/);

  const { address, balanceLineIndex } = collectAddressAndBalance(lines, 2);

  const balanceLine = balanceLineIndex !== -1 ? lines[balanceLineIndex] : "";
  const balanceMatch = balanceLine.match(/Balance as of .* - (.*)/);
  const balance = balanceMatch ? balanceMatch[1].trim() : "N/A";

  const refreshDateLine = lines.find((l) => l.toLowerCase().startsWith("refresh date:"));
  const refreshDateMatch = refreshDateLine?.match(/Refresh Date: ([^\n]+)/) ?? null;

  const rawAccountNumber = accountNumberMatch ? accountNumberMatch[1].trim() : "N/A";

  return {
    accountOwner: ownerList || "N/A",
    accountType,
    bankName: bankNameMatch ? bankNameMatch[1].trim() : "N/A",
    accountNumber: maskAccountNumber(rawAccountNumber),
    address,
    balance,
    balanceAmount: parseBalance(balance),
    refreshDate: refreshDateMatch ? refreshDateMatch[1].trim() : "N/A",
  };
}

/**
 * Split raw AVS input text into individual account block strings.
 *
 * Detects "Account Owner:" markers first (highly reliable); falls back to
 * blank-line / separator splitting.
 *
 * @internal Exported for chunked parsing; prefer {@link parseAVSInput}.
 */
export function splitAVSBlocks(input: string): string[] {
  // Normalize line endings
  const normalized = input.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

  // Strategy 1: Try to detect "Account Owner:" markers (bank-specific format)
  const hasAccountOwnerMarkers = normalized.includes("Account Owner:");

  if (hasAccountOwnerMarkers) {
    const lines = normalized.split("\n");
    const blocks: string[] = [];
    let currentBlock: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toUpperCase().startsWith("ACCOUNT OWNER:")) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join("\n"));
          currentBlock = [];
        }
        currentBlock.push(line);
      } else if (trimmed.length > 0) {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join("\n"));
    }

    return blocks;
  }

  // Strategy 2: Fall back to standard block separators
  return normalized
    .split(/\n\s*\n|\n-{3,}\n|\n={3,}\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

/**
 * Parse multiple account blocks from pasted AVS data (synchronous).
 *
 * Account blocks are typically separated by empty lines or specific delimiters.
 * This function handles common formats.
 *
 * @param input - Raw pasted text containing one or more account blocks
 * @returns Array of successfully parsed accounts
 */
export function parseAVSInput(input: string): ParsedAVSAccount[] {
  if (!input || typeof input !== "string") {
    return [];
  }

  const blocksToUse = splitAVSBlocks(input);

  const parsed: ParsedAVSAccount[] = [];

  for (const block of blocksToUse) {
    const account = parseAccountBlock(block);
    if (account) {
      parsed.push(account);
    }
  }

  return parsed;
}

/**
 * Number of account blocks to process per chunk before yielding to the main thread.
 * Tuned to keep each chunk well under a 16 ms frame budget on mid-range hardware.
 */
const CHUNK_SIZE = 50;

/**
 * Parse AVS input asynchronously using chunked processing.
 *
 * For large inputs the work is split into chunks of {@link CHUNK_SIZE} blocks,
 * yielding to the main thread between chunks so the UI stays responsive.
 * Small inputs (≤ CHUNK_SIZE blocks) are parsed synchronously for zero overhead.
 *
 * @param input - Raw pasted text containing one or more account blocks
 * @param onProgress - Optional callback invoked with (processed, total) after each chunk
 * @returns Promise resolving to the array of successfully parsed accounts
 */
export async function parseAVSInputAsync(
  input: string,
  onProgress?: (processed: number, total: number) => void,
): Promise<ParsedAVSAccount[]> {
  if (!input || typeof input !== "string") {
    return [];
  }

  const blocks = splitAVSBlocks(input);

  // Fast path – no need for async overhead on small inputs
  if (blocks.length <= CHUNK_SIZE) {
    return parseAVSInput(input);
  }

  const parsed: ParsedAVSAccount[] = [];
  let processed = 0;

  for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
    const chunk = blocks.slice(i, i + CHUNK_SIZE);

    for (const block of chunk) {
      const account = parseAccountBlock(block);
      if (account) {
        parsed.push(account);
      }
    }

    processed += chunk.length;
    onProgress?.(processed, blocks.length);

    // Yield to the main thread between chunks
    if (i + CHUNK_SIZE < blocks.length) {
      await yieldToMain();
    }
  }

  return parsed;
}

/**
 * Normalize account type to title case (e.g., "CHECKING" -> "Checking")
 */
function normalizeAccountType(accountType: string): string {
  if (accountType === "N/A") {
    return "Account";
  }

  // Convert to title case: "CHECKING ACCOUNT" -> "Checking Account"
  return accountType
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Convert a parsed AVS account to a financial resource item format
 *
 * @param account - Parsed AVS account
 * @returns Data formatted for FinancialItem creation
 */
export function avsAccountToFinancialItem(
  account: ParsedAVSAccount
): Omit<FinancialItem, "id" | "createdAt" | "updatedAt"> {
  return {
    description: normalizeAccountType(account.accountType),
    amount: account.balanceAmount,
    location: account.bankName !== "N/A" ? account.bankName : undefined,
    accountNumber:
      account.accountNumber !== "N/A"
        ? `****${account.accountNumber}`
        : undefined,
    owner: account.accountOwner !== "N/A" ? account.accountOwner : undefined,
    verificationStatus: "Verified",
    verificationSource: "AVS",
    dateAdded: new Date().toISOString(),
  };
}

/**
 * Batch convert parsed AVS accounts to financial items
 */
export function avsAccountsToFinancialItems(
  accounts: ParsedAVSAccount[]
): Omit<FinancialItem, "id" | "createdAt" | "updatedAt">[] {
  return accounts.map(avsAccountToFinancialItem);
}

/**
 * Normalize a description for fuzzy comparison.
 *
 * Strips the word "Account", lowercases, and collapses whitespace so that
 * "CHECKING ACCOUNT" and "Checking" are treated as equivalent.
 */
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/\baccount\b/gi, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

/**
 * Check whether two masked account numbers refer to the same underlying
 * account.  Handles the common `****XXXX` format; falls back to exact match.
 *
 * Returns `true` when the last‑4 digits after stripping mask characters match.
 *
 * NOTE: Accounts with fewer than 4 visible digits after mask stripping (e.g.
 * `****123`) will never match via the last-4 comparison. This is intentional —
 * fewer than 4 digits provide insufficient confidence for a reliable match.
 */
function accountNumbersMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const stripMask = (s: string) => s.replace(/[*x]/gi, "");
  const aDigits = stripMask(a);
  const bDigits = stripMask(b);
  if (aDigits.length === 0 || bDigits.length === 0) return false;
  // Compare last 4 digits
  const aLast4 = aDigits.slice(-4);
  const bLast4 = bDigits.slice(-4);
  return aLast4.length >= 4 && bLast4.length >= 4 && aLast4 === bLast4;
}

/**
 * Confidence level returned by {@link findMatchingFinancialItem}.
 *
 * - `exact`  — account number AND description both match
 * - `high`   — account number matches, descriptions are equivalent after normalization
 * - `medium` — only account numbers match (different description)
 * - `low`    — no account number on new item; matched by description + location/bankName
 */
export type MatchConfidence = "exact" | "high" | "medium" | "low";

export interface MatchResult<T> {
  item: T;
  confidence: MatchConfidence;
}

/**
 * Find a matching existing financial item using tiered matching.
 *
 * Matching tiers (first match wins):
 * 1. **Exact** — `accountNumber` strict-equal AND `description` strict-equal
 * 2. **High**  — account numbers match (last-4) AND descriptions match after normalization
 * 3. **Medium** — account numbers match (last-4), description differs
 * 4. **Low**   — no account number on new item; description (normalized) + location/bankName match
 *
 * @param newItem   The incoming item data from AVS import
 * @param existingItems  Array of existing financial items to search
 * @param newItemBankName  Optional bank name from the parsed AVS account (used for low-confidence fallback)
 * @returns Match result with the item and confidence, or `undefined` if no match
 */
/**
 * Match by account number (Tiers 1-3): exact > high > medium.
 * Returns undefined if no account-number-based match found.
 */
function matchByAccountNumber<
  T extends { id: string; accountNumber?: string; description: string; location?: string },
>(
  newItem: { accountNumber: string; description: string },
  existingItems: T[],
  newDesc: string,
): MatchResult<T> | undefined {
  let mediumMatch: MatchResult<T> | undefined;

  for (const existing of existingItems) {
    if (!existing.accountNumber) continue;
    if (!accountNumbersMatch(newItem.accountNumber, existing.accountNumber)) continue;

    if (existing.description === newItem.description) {
      return { item: existing, confidence: "exact" };
    }
    if (normalizeDescription(existing.description) === newDesc) {
      return { item: existing, confidence: "high" };
    }
    if (!mediumMatch) {
      mediumMatch = { item: existing, confidence: "medium" };
    }
  }

  return mediumMatch;
}

/**
 * Match by description + location (Tier 4 fallback).
 */
function matchByDescriptionLocation<
  T extends { id: string; accountNumber?: string; description: string; location?: string },
>(existingItems: T[], newDesc: string, bankNameLower: string | undefined): MatchResult<T> | undefined {
  if (!bankNameLower) return undefined;

  for (const existing of existingItems) {
    if (normalizeDescription(existing.description) !== newDesc) continue;
    if (existing.location?.toLowerCase() === bankNameLower) {
      return { item: existing, confidence: "low" };
    }
  }
  return undefined;
}

export function findMatchingFinancialItem<
  T extends { id: string; accountNumber?: string; description: string; location?: string },
>(
  newItem: { accountNumber?: string; description: string },
  existingItems: T[],
  newItemBankName?: string,
): MatchResult<T> | undefined {
  const newDesc = normalizeDescription(newItem.description);

  if (newItem.accountNumber) {
    const acctMatch = matchByAccountNumber(newItem as { accountNumber: string; description: string }, existingItems, newDesc);
    if (acctMatch) return acctMatch;
  }

  if (!newItem.accountNumber || newItem.accountNumber === "N/A") {
    return matchByDescriptionLocation(existingItems, newDesc, newItemBankName?.toLowerCase());
  }

  return undefined;
}
