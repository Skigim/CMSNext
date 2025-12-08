/**
 * AVS (Account Verification Service) Parser
 * ==========================================
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
 */

/**
 * Known account types that can appear at the end of the first line
 */
export const KNOWN_ACCOUNT_TYPES = [
  'CHECKING',
  'SAVINGS',
  'MONEY MARKET',
  'CD',
  'CERTIFICATE OF DEPOSIT',
  'IRA',
  'ROTH IRA',
  '401K',
  '401(K)',
  'BROKERAGE',
  'INVESTMENT',
  'PENSION',
  'ANNUITY',
  'LIFE INSURANCE',
  'MUTUAL FUND',
  'TRUST',
  // With "Account" suffix (common bank format)
  'CHECKING ACCOUNT',
  'SAVINGS ACCOUNT',
  'MONEY MARKET ACCOUNT',
] as const;

export type KnownAccountType = typeof KNOWN_ACCOUNT_TYPES[number];

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
  if (!balanceStr || balanceStr === 'N/A') {
    return 0;
  }
  // Remove currency symbols, commas, and whitespace
  const cleaned = balanceStr.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse a single account block from AVS data
 * 
 * @param block - A single account block text
 * @returns Parsed account data or null if parsing fails
 */
export function parseAccountBlock(block: string): ParsedAVSAccount | null {
  const lines = block.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    return null;
  }

  let firstLine = lines[0].trim();
  
  // Strip "Account Owner:" prefix if present (common bank format)
  if (firstLine.toUpperCase().startsWith('ACCOUNT OWNER:')) {
    firstLine = firstLine.slice('Account Owner:'.length).trim();
  }
  
  let accountType = 'N/A';
  let owners = 'N/A';

  // Try to extract account type from end of first line
  // Sort by length (longest first) to match "CHECKING ACCOUNT" before "CHECKING"
  const sortedTypes = [...KNOWN_ACCOUNT_TYPES].sort((a, b) => b.length - a.length);
  for (const type of sortedTypes) {
    if (firstLine.toUpperCase().endsWith(type.toUpperCase())) {
      accountType = type;
      owners = firstLine.slice(0, -type.length).trim();
      break;
    }
  }

  // If no account type found, entire first line is owners
  if (accountType === 'N/A') {
    owners = firstLine;
  }

  // Convert semicolon-separated owners to comma-separated
  const ownerList = owners
    .split(';')
    .map(o => o.trim())
    .filter(o => o.length > 0)
    .join(', ');

  // Parse bank name and account number from second line
  const bankLine = lines[1] || '';
  const bankNameMatch = bankLine.match(/([^\n]+) - \(/);
  const accountNumberMatch = bankLine.match(/ - \((\d+)\)/);

  // Collect address lines (everything between bank line and balance line)
  const addressLines: string[] = [];
  let balanceLineIndex = -1;

  for (let i = 2; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes('balance as of')) {
      balanceLineIndex = i;
      break;
    }
    addressLines.push(lines[i].trim());
  }

  const address = addressLines.join(' ');

  // Extract balance
  const balanceLine = balanceLineIndex !== -1 ? lines[balanceLineIndex] : '';
  const balanceMatch = balanceLine.match(/Balance as of .* - (.*)/);
  const balance = balanceMatch ? balanceMatch[1].trim() : 'N/A';

  // Extract refresh date
  const refreshDateLine = lines.find(l => l.toLowerCase().startsWith('refresh date:'));
  const refreshDateMatch = refreshDateLine ? refreshDateLine.match(/Refresh Date: ([^\n]+)/) : null;

  // Extract and mask account number (last 4 digits only)
  let accountNumber = accountNumberMatch ? accountNumberMatch[1].trim() : 'N/A';
  if (accountNumber !== 'N/A' && accountNumber.length > 4) {
    accountNumber = accountNumber.slice(-4);
  }

  return {
    accountOwner: ownerList || 'N/A',
    accountType,
    bankName: bankNameMatch ? bankNameMatch[1].trim() : 'N/A',
    accountNumber,
    address,
    balance,
    balanceAmount: parseBalance(balance),
    refreshDate: refreshDateMatch ? refreshDateMatch[1].trim() : 'N/A',
  };
}

/**
 * Parse multiple account blocks from pasted AVS data
 * 
 * Account blocks are typically separated by empty lines or specific delimiters.
 * This function handles common formats.
 * 
 * @param input - Raw pasted text containing one or more account blocks
 * @returns Array of successfully parsed accounts
 */
export function parseAVSInput(input: string): ParsedAVSAccount[] {
  if (!input || typeof input !== 'string') {
    return [];
  }

  // Normalize line endings
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Strategy 1: Try to detect "Account Owner:" markers (bank-specific format)
  // These are highly reliable block delimiters
  const hasAccountOwnerMarkers = normalized.includes('Account Owner:');
  
  let blocksToUse: string[];

  if (hasAccountOwnerMarkers) {
    // Use Account Owner markers as block delimiters
    const lines = normalized.split('\n');
    const blocks: string[] = [];
    let currentBlock: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Start a new block if we see "Account Owner:" and we already have content
      if (trimmed.toUpperCase().startsWith('ACCOUNT OWNER:')) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'));
          currentBlock = [];
        }
        currentBlock.push(line);
      } else if (trimmed.length > 0) {
        // Add non-empty lines to current block
        currentBlock.push(line);
      }
    }

    // Don't forget the last block
    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'));
    }

    blocksToUse = blocks;
  } else {
    // Strategy 2: Fall back to standard block separators
    blocksToUse = normalized
      .split(/\n\s*\n|\n-{3,}\n|\n={3,}\n/)
      .map(block => block.trim())
      .filter(block => block.length > 0);
  }

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
 * Normalize account type to title case (e.g., "CHECKING" -> "Checking")
 */
function normalizeAccountType(accountType: string): string {
  if (accountType === 'N/A') {
    return 'Account';
  }
  
  // Convert to title case: "CHECKING ACCOUNT" -> "Checking Account"
  return accountType
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert a parsed AVS account to a financial resource item format
 * 
 * @param account - Parsed AVS account
 * @returns Data formatted for FinancialItem creation
 */
export function avsAccountToFinancialItem(
  account: ParsedAVSAccount
): Omit<import('../types/case').FinancialItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    description: normalizeAccountType(account.accountType),
    amount: account.balanceAmount,
    location: account.bankName !== 'N/A' ? account.bankName : undefined,
    accountNumber: account.accountNumber !== 'N/A' ? `****${account.accountNumber}` : undefined,
    owner: account.accountOwner !== 'N/A' ? account.accountOwner : undefined,
    verificationStatus: 'Verified',
    verificationSource: 'AVS',
    dateAdded: new Date().toISOString(),
  };
}

/**
 * Batch convert parsed AVS accounts to financial items
 */
export function avsAccountsToFinancialItems(
  accounts: ParsedAVSAccount[]
): Omit<import('../types/case').FinancialItem, 'id' | 'createdAt' | 'updatedAt'>[] {
  return accounts.map(avsAccountToFinancialItem);
}

/**
 * Find a matching existing financial item based on accountNumber and description
 * 
 * Match criteria: same accountNumber AND same description (account type)
 * 
 * @param newItem - The new item data from AVS import
 * @param existingItems - Array of existing financial items to search
 * @returns The matching existing item, or undefined if no match
 */
export function findMatchingFinancialItem<T extends { id: string; accountNumber?: string; description: string }>(
  newItem: { accountNumber?: string; description: string },
  existingItems: T[]
): T | undefined {
  if (!newItem.accountNumber) {
    // Can't match without an account number
    return undefined;
  }
  
  return existingItems.find(existing =>
    existing.accountNumber === newItem.accountNumber &&
    existing.description === newItem.description
  );
}
