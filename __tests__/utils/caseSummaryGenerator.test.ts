/**
 * Case Summary Generator Tests
 * ============================
 * Tests for the plain-text case summary generation for sharing.
 */

import { describe, it, expect } from 'vitest';
import { generateCaseSummary } from '../../utils/caseSummaryGenerator';
import { StoredCase, FinancialItem, Note } from '../../types/case';

// Helper to create a minimal valid StoredCase
function createMockCase(overrides: Partial<StoredCase> = {}): StoredCase {
  return {
    id: 'case-123',
    name: 'John Doe',
    mcn: 'MCN-12345',
    status: 'Active',
    priority: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    person: {
      id: 'person-1',
      firstName: 'John',
      lastName: 'Doe',
      name: 'John Doe',
      email: 'john.doe@email.com',
      phone: '(555) 123-4567',
      dateOfBirth: '1950-01-15',
      ssn: '123-45-6789',
      organizationId: null,
      livingArrangement: 'Home',
      address: { street: '123 Main St', city: 'Anytown', state: 'CA', zip: '12345' },
      mailingAddress: { street: '123 Main St', city: 'Anytown', state: 'CA', zip: '12345', sameAsPhysical: true },
      authorizedRepIds: [],
      familyMembers: [],
      relationships: [],
      status: 'Active',
      createdAt: '2024-01-01T00:00:00.000Z',
      dateAdded: '2024-01-01',
    },
    caseRecord: {
      id: 'case-123',
      mcn: 'MCN-12345',
      applicationDate: '2024-06-15',
      caseType: 'Medicaid',
      personId: 'person-1',
      spouseId: '',
      status: 'Active',
      description: '',
      priority: false,
      livingArrangement: 'Home',
      withWaiver: false,
      admissionDate: '',
      organizationId: '',
      authorizedReps: [],
      retroRequested: '',
      createdDate: '2024-01-01T00:00:00.000Z',
      updatedDate: '2024-06-15T00:00:00.000Z',
      citizenshipVerified: false,
      agedDisabledVerified: false,
    },
    ...overrides,
  };
}

describe('generateCaseSummary', () => {
  describe('Case Info Section', () => {
    it('formats application date as MM/DD/YYYY', () => {
      const caseData = createMockCase({
        caseRecord: {
          ...createMockCase().caseRecord,
          applicationDate: '2024-12-04',
        },
      });

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('Application Date: 12/04/2024');
    });

    it('shows "None" for missing application date', () => {
      const caseData = createMockCase({
        caseRecord: {
          ...createMockCase().caseRecord,
          applicationDate: '',
        },
      });

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('Application Date: None');
    });

    it('displays retro requested value', () => {
      const caseData = createMockCase({
        caseRecord: {
          ...createMockCase().caseRecord,
          retroRequested: '3 months',
        },
      });

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('Retro Requested: 3 months');
    });

    it('shows "None" for empty retro requested', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('Retro Requested: None');
    });

    it('displays waiver requested as Yes/No', () => {
      const caseWithWaiver = createMockCase({
        caseRecord: {
          ...createMockCase().caseRecord,
          withWaiver: true,
        },
      });
      const caseWithoutWaiver = createMockCase();

      expect(generateCaseSummary(caseWithWaiver)).toContain('Waiver Requested: Yes');
      expect(generateCaseSummary(caseWithoutWaiver)).toContain('Waiver Requested: No');
    });
  });

  describe('Person Info Section', () => {
    it('displays full name on first line', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('John Doe');
    });

    it('displays email and phone separated by pipe', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('john.doe@email.com | (555) 123-4567');
    });

    it('formats raw 10-digit phone number', () => {
      const caseData = createMockCase({
        person: {
          ...createMockCase().person,
          phone: '5551234567',
        },
      });

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('(555) 123-4567');
    });

    it('formats 11-digit phone number with leading 1', () => {
      const caseData = createMockCase({
        person: {
          ...createMockCase().person,
          phone: '15559876543',
        },
      });

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('(555) 987-6543');
    });

    it('shows only email if no phone', () => {
      const caseData = createMockCase({
        person: {
          ...createMockCase().person,
          phone: '',
        },
      });

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('john.doe@email.com');
      expect(summary).not.toContain('john.doe@email.com |');
    });

    it('shows "No contact info" if both email and phone missing', () => {
      const caseData = createMockCase({
        person: {
          ...createMockCase().person,
          email: '',
          phone: '',
        },
      });

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('No contact info');
    });

    it('displays citizenship verified as Yes/No', () => {
      const verifiedCase = createMockCase({
        caseRecord: {
          ...createMockCase().caseRecord,
          citizenshipVerified: true,
        },
      });
      const unverifiedCase = createMockCase();

      expect(generateCaseSummary(verifiedCase)).toContain('Citizenship Verified: Yes');
      expect(generateCaseSummary(unverifiedCase)).toContain('Citizenship Verified: No');
    });

    it('displays aged/disabled verified as Yes/No', () => {
      const verifiedCase = createMockCase({
        caseRecord: {
          ...createMockCase().caseRecord,
          agedDisabledVerified: true,
        },
      });
      const unverifiedCase = createMockCase();

      expect(generateCaseSummary(verifiedCase)).toContain('Aged/Disabled Verified: Yes');
      expect(generateCaseSummary(unverifiedCase)).toContain('Aged/Disabled Verified: No');
    });

    it('displays living arrangement', () => {
      const caseData = createMockCase({
        caseRecord: {
          ...createMockCase().caseRecord,
          livingArrangement: 'Nursing Facility',
        },
      });

      const summary = generateCaseSummary(caseData);

      expect(summary).toContain('Living Arrangement: Nursing Facility');
    });

    it('shows "None" for empty living arrangement', () => {
      const caseData = createMockCase({
        caseRecord: {
          ...createMockCase().caseRecord,
          livingArrangement: '',
        },
      });

      const summary = generateCaseSummary(caseData);

      expect(summary).toContain('Living Arrangement: None');
    });
  });

  describe('Relationships Section', () => {
    it('shows "None" when no relationships', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('Relationships\nNone');
    });

    it('formats relationships as Type | Name | Phone', () => {
      const caseData = createMockCase({
        person: {
          ...createMockCase().person,
          relationships: [
            { type: 'Authorized Rep', name: 'Jane Smith', phone: '(555) 987-6543' },
          ],
        },
      });

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('Authorized Rep | Jane Smith | (555) 987-6543');
    });

    it('formats raw phone numbers in relationships', () => {
      const caseData = createMockCase({
        person: {
          ...createMockCase().person,
          relationships: [
            { type: 'Spouse', name: 'Mary Doe', phone: '5551112222' },
          ],
        },
      });

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('Spouse | Mary Doe | (555) 111-2222');
    });

    it('formats relationship without phone as Type | Name', () => {
      const caseData = createMockCase({
        person: {
          ...createMockCase().person,
          relationships: [
            { type: 'Spouse', name: 'Mary Doe', phone: '' },
          ],
        },
      });

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('Spouse | Mary Doe');
      expect(summary).not.toContain('Spouse | Mary Doe |');
    });

    it('displays multiple relationships', () => {
      const caseData = createMockCase({
        person: {
          ...createMockCase().person,
          relationships: [
            { type: 'Authorized Rep', name: 'Jane Smith', phone: '(555) 111-1111' },
            { type: 'Child', name: 'Bob Doe', phone: '(555) 222-2222' },
          ],
        },
      });

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('Authorized Rep | Jane Smith | (555) 111-1111');
      expect(summary).toContain('Child | Bob Doe | (555) 222-2222');
    });
  });

  describe('Resources Section', () => {
    it('shows "None" when no resources', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('Resources\nNone');
    });

    it('formats resource with all fields', () => {
      const caseData = createMockCase();
      const financials = {
        resources: [
          {
            id: 'res-1',
            description: 'Checking Account',
            accountNumber: '1234',
            location: 'Chase Bank',
            amount: 5250,
            verificationStatus: 'Verified',
            verificationSource: 'Bank Statement',
          } as FinancialItem,
        ],
        income: [],
        expenses: [],
      };

      const summary = generateCaseSummary(caseData, { financials, notes: [] });
      
      expect(summary).toContain('Checking Account 1234 w/ Chase Bank - $5,250.00 (Bank Statement)');
    });

    it('shows status instead of verification source when not verified', () => {
      const caseData = createMockCase();
      const financials = {
        resources: [
          {
            id: 'res-1',
            description: 'Savings Account',
            accountNumber: '5678',
            location: 'Wells Fargo',
            amount: 12000,
            verificationStatus: 'Pending',
          } as FinancialItem,
        ],
        income: [],
        expenses: [],
      };

      const summary = generateCaseSummary(caseData, { financials, notes: [] });
      
      expect(summary).toContain('Savings Account 5678 w/ Wells Fargo - $12,000.00 (Pending)');
    });

    it('formats currency with cents', () => {
      const caseData = createMockCase();
      const financials = {
        resources: [
          {
            id: 'res-1',
            description: 'Cash',
            amount: 1500.5,
            verificationStatus: '',
          } as FinancialItem,
        ],
        income: [],
        expenses: [],
      };

      const summary = generateCaseSummary(caseData, { financials, notes: [] });
      
      expect(summary).toContain('$1,500.50');
    });
  });

  describe('Income Section', () => {
    it('shows "None" when no income', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('Income\nNone');
    });

    it('formats income with "from" preposition and frequency', () => {
      const caseData = createMockCase();
      const financials = {
        resources: [],
        income: [
          {
            id: 'inc-1',
            description: 'Social Security',
            location: 'SSA',
            amount: 1850,
            frequency: 'monthly',
            verificationStatus: 'Verified',
            verificationSource: 'Award Letter',
          } as FinancialItem,
        ],
        expenses: [],
      };

      const summary = generateCaseSummary(caseData, { financials, notes: [] });
      
      expect(summary).toContain('Social Security from SSA - $1,850.00/Monthly (Award Letter)');
    });

    it('shows status when income not verified', () => {
      const caseData = createMockCase();
      const financials = {
        resources: [],
        income: [
          {
            id: 'inc-1',
            description: 'Pension',
            location: 'State Retirement',
            amount: 750,
            frequency: 'monthly',
            verificationStatus: 'In Progress',
          } as FinancialItem,
        ],
        expenses: [],
      };

      const summary = generateCaseSummary(caseData, { financials, notes: [] });
      
      expect(summary).toContain('Pension from State Retirement - $750.00/Monthly (In Progress)');
    });
  });

  describe('Expenses Section', () => {
    it('shows "None" when no expenses', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('Expenses\nNone');
    });

    it('formats expense with "to" preposition and frequency', () => {
      const caseData = createMockCase();
      const financials = {
        resources: [],
        income: [],
        expenses: [
          {
            id: 'exp-1',
            description: 'Rent',
            location: 'Sunset Apartments',
            amount: 1200,
            frequency: 'monthly',
            verificationStatus: 'Verified',
            verificationSource: 'Lease Agreement',
          } as FinancialItem,
        ],
      };

      const summary = generateCaseSummary(caseData, { financials, notes: [] });
      
      expect(summary).toContain('Rent to Sunset Apartments - $1,200.00/Monthly (Lease Agreement)');
    });

    it('shows status when expense not verified', () => {
      const caseData = createMockCase();
      const financials = {
        resources: [],
        income: [],
        expenses: [
          {
            id: 'exp-1',
            description: 'Utilities',
            location: 'Power Co',
            amount: 150,
            frequency: 'monthly',
            verificationStatus: 'VR Pending',
          } as FinancialItem,
        ],
      };

      const summary = generateCaseSummary(caseData, { financials, notes: [] });
      
      expect(summary).toContain('Utilities to Power Co - $150.00/Monthly (VR Pending)');
    });
  });

  describe('Notes Section', () => {
    it('shows "None" when no notes', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData);
      
      expect(summary).toContain('MLTC: None');
    });

    it('displays full note content without truncation', () => {
      const caseData = createMockCase();
      const longContent = 'A'.repeat(500);
      const notes: Note[] = [
        {
          id: 'note-1',
          category: 'General',
          content: longContent,
          createdAt: '2024-06-01T10:00:00.000Z',
          updatedAt: '2024-06-01T10:00:00.000Z',
        },
      ];

      const summary = generateCaseSummary(caseData, { notes });
      
      expect(summary).toContain(`MLTC: ${longContent}`);
    });

    it('displays notes in chronological order (oldest first)', () => {
      const caseData = createMockCase();
      const notes: Note[] = [
        {
          id: 'note-2',
          category: 'General',
          content: 'Second note',
          createdAt: '2024-06-02T10:00:00.000Z',
          updatedAt: '2024-06-02T10:00:00.000Z',
        },
        {
          id: 'note-1',
          category: 'General',
          content: 'First note',
          createdAt: '2024-06-01T10:00:00.000Z',
          updatedAt: '2024-06-01T10:00:00.000Z',
        },
      ];

      const summary = generateCaseSummary(caseData, { notes });
      
      const firstNoteIndex = summary.indexOf('First note');
      const secondNoteIndex = summary.indexOf('Second note');
      expect(firstNoteIndex).toBeLessThan(secondNoteIndex);
      // Notes should appear first in the summary
      expect(summary.startsWith('MLTC:')).toBe(true);
    });

    it('separates multiple notes with blank lines', () => {
      const caseData = createMockCase();
      const notes: Note[] = [
        {
          id: 'note-1',
          category: 'General',
          content: 'Note one content',
          createdAt: '2024-06-01T10:00:00.000Z',
          updatedAt: '2024-06-01T10:00:00.000Z',
        },
        {
          id: 'note-2',
          category: 'General',
          content: 'Note two content',
          createdAt: '2024-06-02T10:00:00.000Z',
          updatedAt: '2024-06-02T10:00:00.000Z',
        },
      ];

      const summary = generateCaseSummary(caseData, { notes });
      
      expect(summary).toContain('MLTC: Note one content\n\nNote two content');
    });
  });

  describe('Section Separators', () => {
    it('uses ----- as separator between sections', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData);
      
      // Should have 6 separators (between 7 sections with notes first)
      const separatorCount = (summary.match(/\n-----\n/g) || []).length;
      expect(separatorCount).toBe(6);
    });
  });

  describe('Edge Cases', () => {
    it('handles missing optional fields gracefully', () => {
      const caseData = createMockCase({
        person: {
          ...createMockCase().person,
          relationships: undefined,
        },
      });

      // Should not throw
      const summary = generateCaseSummary(caseData);
      expect(summary).toContain('Relationships\nNone');
    });

    it('handles empty financials object', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData, { financials: { resources: [], income: [], expenses: [] }, notes: [] });
      
      expect(summary).toContain('Resources\nNone');
      expect(summary).toContain('Income\nNone');
      expect(summary).toContain('Expenses\nNone');
    });

    it('handles financial item with status field instead of verificationStatus', () => {
      const caseData = createMockCase();
      const financials = {
        resources: [
          {
            id: 'res-1',
            description: 'Asset',
            amount: 1000,
            verificationStatus: '',
            status: 'Approved' as const,
          } as FinancialItem,
        ],
        income: [],
        expenses: [],
      };

      const summary = generateCaseSummary(caseData, { financials, notes: [] });
      
      expect(summary).toContain('Asset - $1,000.00 (Approved)');
    });
  });

  describe('Section Filtering', () => {
    it('includes all sections by default', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData);

      expect(summary).toContain('MLTC:'); // Notes come first
      expect(summary).toContain('Application Date:');
      expect(summary).toContain('John Doe');
      expect(summary).toContain('Relationships');
      expect(summary).toContain('Resources');
      expect(summary).toContain('Income');
      expect(summary).toContain('Expenses');
    });

    it('excludes sections when disabled', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData, {
        sections: {
          caseInfo: false,
          personInfo: true,
          relationships: false,
          resources: false,
          income: false,
          expenses: false,
          notes: false,
        },
      });

      expect(summary).not.toContain('Application Date:');
      expect(summary).toContain('John Doe'); // personInfo is enabled
      expect(summary).not.toContain('Relationships');
      expect(summary).not.toContain('Resources');
      expect(summary).not.toContain('Income');
      expect(summary).not.toContain('Expenses');
      expect(summary).not.toContain('Notes');
    });

    it('returns empty string when all sections disabled', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData, {
        sections: {
          caseInfo: false,
          personInfo: false,
          relationships: false,
          resources: false,
          income: false,
          expenses: false,
          notes: false,
        },
      });

      expect(summary).toBe('');
    });

    it('only includes enabled sections with correct separators', () => {
      const caseData = createMockCase();

      const summary = generateCaseSummary(caseData, {
        sections: {
          caseInfo: true,
          personInfo: false,
          relationships: false,
          resources: true,
          income: false,
          expenses: false,
          notes: false,
        },
      });

      // Should have exactly one separator between the two enabled sections
      const separatorCount = (summary.match(/\n-----\n/g) || []).length;
      expect(separatorCount).toBe(1);
      expect(summary).toContain('Application Date:');
      expect(summary).toContain('Resources');
      expect(summary).not.toContain('MLTC:');
    });
  });
});
