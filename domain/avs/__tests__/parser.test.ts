import { describe, it, expect } from 'vitest';
import {
  parseAccountBlock,
  parseAVSInput,
  parseAVSInputAsync,
  splitAVSBlocks,
  avsAccountToFinancialItem,
  avsAccountsToFinancialItems,
  findMatchingFinancialItem,
  KNOWN_ACCOUNT_TYPES,
} from '../parser';

describe('avsParser', () => {
  describe('parseAccountBlock', () => {
    it('parses a complete account block with all fields', () => {
      const block = `John Doe; Jane Doe CHECKING
First National Bank - (123456789)
123 Main Street
Anytown, ST 12345
Balance as of 12/01/2025 - $5,432.10
Refresh Date: 12/01/2025`;

      const result = parseAccountBlock(block);

      expect(result).not.toBeNull();
      expect(result?.accountOwner).toBe('John Doe, Jane Doe');
      expect(result?.accountType).toBe('CHECKING');
      expect(result?.bankName).toBe('First National Bank');
      expect(result?.accountNumber).toBe('6789');
      expect(result?.address).toBe('123 Main Street Anytown, ST 12345');
      expect(result?.balance).toBe('$5,432.10');
      expect(result?.balanceAmount).toBe(5432.1);
      expect(result?.refreshDate).toBe('12/01/2025');
    });

    it('parses account with SAVINGS type', () => {
      const block = `Jane Smith SAVINGS
Community Credit Union - (9876)
456 Oak Ave
Balance as of 11/15/2025 - $10,000.00`;

      const result = parseAccountBlock(block);

      expect(result?.accountType).toBe('SAVINGS');
      expect(result?.accountOwner).toBe('Jane Smith');
      expect(result?.bankName).toBe('Community Credit Union');
      expect(result?.accountNumber).toBe('9876');
      expect(result?.balanceAmount).toBe(10000);
    });

    it('handles accounts without recognized type', () => {
      const block = `John Doe - Unknown Account Type
Some Bank - (1234)
Balance as of 01/01/2025 - $100.00`;

      const result = parseAccountBlock(block);

      expect(result?.accountType).toBe('N/A');
      expect(result?.accountOwner).toBe('John Doe - Unknown Account Type');
    });

    it('returns null for blocks with less than 2 lines', () => {
      expect(parseAccountBlock('Single line')).toBeNull();
      expect(parseAccountBlock('')).toBeNull();
    });

    it('masks account number to last 4 digits', () => {
      const block = `Owner CHECKING
Bank - (12345678901234)
Balance as of 01/01/2025 - $0.00`;

      const result = parseAccountBlock(block);
      expect(result?.accountNumber).toBe('1234');
    });

    it('handles missing balance line', () => {
      const block = `Owner CHECKING
Bank - (1234)
123 Main St`;

      const result = parseAccountBlock(block);

      expect(result?.balance).toBe('N/A');
      expect(result?.balanceAmount).toBe(0);
    });

    it('handles missing refresh date', () => {
      const block = `Owner CHECKING
Bank - (1234)
Balance as of 01/01/2025 - $500.00`;

      const result = parseAccountBlock(block);
      expect(result?.refreshDate).toBe('N/A');
    });
  });

  describe('parseAVSInput', () => {
    it('parses multiple account blocks separated by double newlines', () => {
      const input = `Owner1 CHECKING
Bank1 - (1111)
Balance as of 01/01/2025 - $1,000.00

Owner2 SAVINGS
Bank2 - (2222)
Balance as of 01/01/2025 - $2,000.00`;

      const results = parseAVSInput(input);

      expect(results).toHaveLength(2);
      expect(results[0].accountType).toBe('CHECKING');
      expect(results[1].accountType).toBe('SAVINGS');
    });

    it('handles blocks separated by dashes', () => {
      const input = `Owner1 CHECKING
Bank1 - (1111)
Balance as of 01/01/2025 - $1,000.00
---
Owner2 SAVINGS
Bank2 - (2222)
Balance as of 01/01/2025 - $2,000.00`;

      const results = parseAVSInput(input);
      expect(results).toHaveLength(2);
    });

    it('returns empty array for empty input', () => {
      expect(parseAVSInput('')).toEqual([]);
      expect(parseAVSInput('   ')).toEqual([]);
    });

    it('handles Windows line endings', () => {
      const input = `Owner CHECKING\r\nBank - (1234)\r\nBalance as of 01/01/2025 - $100.00`;
      const results = parseAVSInput(input);
      expect(results).toHaveLength(1);
    });

    it('filters out unparseable blocks', () => {
      const input = `Owner CHECKING
Bank - (1234)
Balance as of 01/01/2025 - $100.00

Single line block

Another SAVINGS
AnotherBank - (5678)
Balance as of 01/01/2025 - $200.00`;

      const results = parseAVSInput(input);
      expect(results).toHaveLength(2);
    });

    it('parses multiple accounts with "Account Owner:" prefix and "Checking Account" suffix', () => {
      const input = `Account Owner: GERALD FORD;OR KARL MARXChecking Account
US Bank National Association - (00001234)
425 Walnut Street, Cincinnati, OH 45202
Balance as of November 2025 - $199.99
Refresh Date: December 04, 2025
Account Owner: GERALD FORD;OR KARL MARXChecking Account
US Bank National Association - (00001235)
425 Walnut Street, Cincinnati, OH 45202
Balance as of November 2025 - $199.99
Refresh Date: December 04, 2025
Account Owner: GERALD FORD;OR KARL MARXChecking Account
US Bank National Association - (00001236)
425 Walnut Street, Cincinnati, OH 45202
Balance as of November 2025 - $199.99
Refresh Date: December 04, 2025`;

      const results = parseAVSInput(input);

      expect(results).toHaveLength(3);
      expect(results[0].accountOwner).toBe('GERALD FORD, OR KARL MARX');
      expect(results[0].accountType).toBe('CHECKING ACCOUNT');
      expect(results[0].bankName).toBe('US Bank National Association');
      expect(results[0].accountNumber).toBe('1234');
      expect(results[0].balanceAmount).toBe(199.99);
      expect(results[1].accountNumber).toBe('1235');
      expect(results[2].accountNumber).toBe('1236');
    });

    it('handles "Account Owner:" prefix in parsing', () => {
      const input = `Account Owner: JOHN DOECHECKING
First National Bank - (5555)
Balance as of 01/01/2025 - $1,000.00`;

      const results = parseAVSInput(input);

      expect(results).toHaveLength(1);
      expect(results[0].accountOwner).toBe('JOHN DOE');
      expect(results[0].accountType).toBe('CHECKING');
    });
  });

  describe('avsAccountToFinancialItem', () => {
    it('converts parsed account to financial item format', () => {
      const account = {
        accountOwner: 'John Doe',
        accountType: 'CHECKING',
        bankName: 'First National Bank',
        accountNumber: '6789',
        address: '123 Main St',
        balance: '$5,000.00',
        balanceAmount: 5000,
        refreshDate: '12/01/2025',
      };

      const item = avsAccountToFinancialItem(account);

      expect(item.description).toBe('Checking');
      expect(item.amount).toBe(5000);
      expect(item.location).toBe('First National Bank');
      expect(item.accountNumber).toBe('****6789');
      expect(item.owner).toBe('John Doe');
      expect(item.verificationStatus).toBe('Verified');
      expect(item.verificationSource).toBe('AVS');
      expect(item.notes).toBeUndefined();
      expect(item.dateAdded).toBeDefined();
    });

    it('handles N/A values gracefully', () => {
      const account = {
        accountOwner: 'N/A',
        accountType: 'N/A',
        bankName: 'N/A',
        accountNumber: 'N/A',
        address: '',
        balance: 'N/A',
        balanceAmount: 0,
        refreshDate: 'N/A',
      };

      const item = avsAccountToFinancialItem(account);

      expect(item.description).toBe('Account');
      expect(item.amount).toBe(0);
      expect(item.location).toBeUndefined();
      expect(item.accountNumber).toBeUndefined();
      expect(item.owner).toBeUndefined();
      expect(item.verificationStatus).toBe('Verified');
      expect(item.verificationSource).toBe('AVS');
      expect(item.notes).toBeUndefined();
    });
  });

  describe('avsAccountsToFinancialItems', () => {
    it('converts multiple accounts to financial items', () => {
      const accounts = [
        {
          accountOwner: 'Owner1',
          accountType: 'CHECKING',
          bankName: 'Bank1',
          accountNumber: '1111',
          address: '',
          balance: '$1,000.00',
          balanceAmount: 1000,
          refreshDate: 'N/A',
        },
        {
          accountOwner: 'Owner2',
          accountType: 'SAVINGS',
          bankName: 'Bank2',
          accountNumber: '2222',
          address: '',
          balance: '$2,000.00',
          balanceAmount: 2000,
          refreshDate: 'N/A',
        },
      ];

      const items = avsAccountsToFinancialItems(accounts);

      expect(items).toHaveLength(2);
      expect(items[0].description).toBe('Checking');
      expect(items[1].description).toBe('Savings');
    });
  });

  describe('KNOWN_ACCOUNT_TYPES', () => {
    it('includes common account types', () => {
      expect(KNOWN_ACCOUNT_TYPES).toContain('CHECKING');
      expect(KNOWN_ACCOUNT_TYPES).toContain('SAVINGS');
      expect(KNOWN_ACCOUNT_TYPES).toContain('MONEY MARKET');
      expect(KNOWN_ACCOUNT_TYPES).toContain('IRA');
      expect(KNOWN_ACCOUNT_TYPES).toContain('401K');
    });
  });

  describe('findMatchingFinancialItem', () => {
    const existingItems = [
      { id: '1', accountNumber: '****1234', description: 'Checking' },
      { id: '2', accountNumber: '****5678', description: 'Savings' },
      { id: '3', accountNumber: '****1234', description: 'Savings' }, // Same number, different type
    ];

    it('finds exact match by accountNumber and description', () => {
      const newItem = { accountNumber: '****1234', description: 'Checking' };
      const match = findMatchingFinancialItem(newItem, existingItems);
      expect(match).toBeDefined();
      expect(match?.item.id).toBe('1');
      expect(match?.confidence).toBe('exact');
    });

    it('returns undefined when no match found', () => {
      const newItem = { accountNumber: '****9999', description: 'Checking' };
      const match = findMatchingFinancialItem(newItem, existingItems);
      expect(match).toBeUndefined();
    });

    it('matches with medium confidence when only accountNumber matches', () => {
      const newItem = { accountNumber: '****1234', description: 'Money Market' };
      const match = findMatchingFinancialItem(newItem, existingItems);
      // Now returns medium confidence (account number match, different description)
      expect(match).toBeDefined();
      expect(match?.confidence).toBe('medium');
    });

    it('does not match if only description matches (with account number present)', () => {
      const newItem = { accountNumber: '****0000', description: 'Checking' };
      const match = findMatchingFinancialItem(newItem, existingItems);
      expect(match).toBeUndefined();
    });

    it('returns undefined when newItem has no accountNumber and no location match', () => {
      const newItem = { description: 'Checking' };
      const match = findMatchingFinancialItem(newItem, existingItems);
      expect(match).toBeUndefined();
    });

    it('distinguishes same accountNumber with different description', () => {
      const checkingItem = { accountNumber: '****1234', description: 'Checking' };
      const savingsItem = { accountNumber: '****1234', description: 'Savings' };
      
      const checkingMatch = findMatchingFinancialItem(checkingItem, existingItems);
      const savingsMatch = findMatchingFinancialItem(savingsItem, existingItems);
      
      // Exact match takes priority over medium confidence
      expect(checkingMatch?.item.id).toBe('1');
      expect(checkingMatch?.confidence).toBe('exact');
      expect(savingsMatch?.item.id).toBe('3');
      expect(savingsMatch?.confidence).toBe('exact');
    });

    it('matches with high confidence when descriptions normalize to same value', () => {
      const items = [
        { id: '10', accountNumber: '****9876', description: 'Checking Account' },
      ];
      const newItem = { accountNumber: '****9876', description: 'Checking' };
      const match = findMatchingFinancialItem(newItem, items);
      expect(match).toBeDefined();
      expect(match?.item.id).toBe('10');
      expect(match?.confidence).toBe('high');
    });

    it('matches with low confidence by description + location when no account number', () => {
      const items = [
        { id: '20', accountNumber: undefined, description: 'Savings', location: 'First National Bank' },
      ];
      const newItem = { description: 'Savings' };
      const match = findMatchingFinancialItem(newItem, items, 'First National Bank');
      expect(match).toBeDefined();
      expect(match?.item.id).toBe('20');
      expect(match?.confidence).toBe('low');
    });

    it('returns undefined for low confidence when location does not match', () => {
      const items = [
        { id: '20', accountNumber: undefined, description: 'Savings', location: 'First National Bank' },
      ];
      const newItem = { description: 'Savings' };
      const match = findMatchingFinancialItem(newItem, items, 'Other Bank');
      expect(match).toBeUndefined();
    });
  });

  describe('splitAVSBlocks', () => {
    it('splits blocks separated by blank lines', () => {
      const input = 'Owner1 CHECKING\nBank1 - (1234)\n\nOwner2 SAVINGS\nBank2 - (5678)';
      const blocks = splitAVSBlocks(input);
      expect(blocks).toHaveLength(2);
    });

    it('splits blocks by Account Owner markers', () => {
      const input = 'Account Owner: John Doe CHECKING\nBank - (1234)\nAccount Owner: Jane SAVINGS\nBank2 - (5678)';
      const blocks = splitAVSBlocks(input);
      expect(blocks).toHaveLength(2);
    });

    it('returns empty array for empty input', () => {
      expect(splitAVSBlocks('')).toHaveLength(0);
    });
  });

  describe('parseAVSInputAsync', () => {
    it('returns same results as synchronous parser for small inputs', async () => {
      const input = `John Doe CHECKING
First National Bank - (123456789)
123 Main Street
Anytown, ST 12345
Balance as of 12/01/2025 - $5,432.10
Refresh Date: 12/01/2025`;

      const syncResult = parseAVSInput(input);
      const asyncResult = await parseAVSInputAsync(input);

      expect(asyncResult).toEqual(syncResult);
      expect(asyncResult).toHaveLength(1);
    });

    it('returns empty array for empty input', async () => {
      expect(await parseAVSInputAsync('')).toEqual([]);
      expect(await parseAVSInputAsync(null as unknown as string)).toEqual([]);
    });
  });
});