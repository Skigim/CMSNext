import { describe, it, expect } from 'vitest';
import { generateCaseSummary } from '../../utils/caseSummaryGenerator';
import { CaseDisplay } from '../../types/case';

describe('caseSummaryGenerator', () => {
  const mockCaseData: CaseDisplay = {
    id: 'case-123',
    name: 'John Doe Case',
    mcn: 'MCN-12345',
    status: 'Active',
    priority: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    person: {
      id: 'person-1',
      firstName: 'John',
      lastName: 'Doe',
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '555-123-4567',
      dateOfBirth: '1980-05-15',
      ssn: '123-45-6789',
      organizationId: null,
      livingArrangement: 'Independent',
      address: {
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
      },
      mailingAddress: {
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        sameAsPhysical: true,
      },
      authorizedRepIds: [],
      familyMembers: [],
      status: 'Active',
      createdAt: '2024-01-01T00:00:00Z',
      dateAdded: '2024-01-01T00:00:00Z',
    },
    caseRecord: {
      id: 'case-123',
      mcn: 'MCN-12345',
      applicationDate: '2024-01-10',
      caseType: 'Medicaid',
      personId: 'person-1',
      spouseId: '',
      status: 'Active',
      description: 'Test case',
      priority: true,
      livingArrangement: 'Independent',
      withWaiver: false,
      admissionDate: '2024-02-01',
      organizationId: 'org-1',
      authorizedReps: [],
      retroRequested: '2023-12-01',
      financials: {
        resources: [
          {
            id: 'res-1',
            description: 'Savings Account',
            amount: 5000,
            verificationStatus: 'Verified',
            accountNumber: '****1234',
          },
        ],
        income: [
          {
            id: 'inc-1',
            description: 'Social Security',
            amount: 1200,
            frequency: 'monthly',
            verificationStatus: 'Verified',
          },
        ],
        expenses: [
          {
            id: 'exp-1',
            description: 'Rent',
            amount: 800,
            frequency: 'monthly',
            verificationStatus: 'VR Pending',
          },
        ],
      },
      notes: [
        {
          id: 'note-1',
          category: 'General',
          content: 'Initial intake completed',
          createdAt: '2024-01-10T10:00:00Z',
          updatedAt: '2024-01-10T10:00:00Z',
        },
        {
          id: 'note-2',
          category: 'Follow-up',
          content: 'Contacted for additional documentation',
          createdAt: '2024-01-12T14:30:00Z',
          updatedAt: '2024-01-12T14:30:00Z',
        },
      ],
      createdDate: '2024-01-01T00:00:00Z',
      updatedDate: '2024-01-15T00:00:00Z',
    },
  };

  it('should generate a summary with all basic information', () => {
    const summary = generateCaseSummary(mockCaseData);

    expect(summary).toContain('CASE SUMMARY');
    expect(summary).toContain('John Doe Case');
    expect(summary).toContain('MCN-12345');
    expect(summary).toContain('case-123');
    expect(summary).toContain('Active');
    expect(summary).toContain('Priority: Yes');
  });

  it('should include person information', () => {
    const summary = generateCaseSummary(mockCaseData);

    expect(summary).toContain('PERSON INFORMATION');
    expect(summary).toContain('John Doe');
    expect(summary).toContain('john.doe@example.com');
    expect(summary).toContain('555-123-4567');
  });

  it('should include key dates formatted properly', () => {
    const summary = generateCaseSummary(mockCaseData);

    expect(summary).toContain('KEY DATES');
    expect(summary).toContain('Application Date:');
    expect(summary).toContain('Admission Date:');
    expect(summary).toContain('Retro Requested:');
  });

  it('should include financial items by category', () => {
    const summary = generateCaseSummary(mockCaseData);

    expect(summary).toContain('FINANCIAL INFORMATION');
    expect(summary).toContain('Resources:');
    expect(summary).toContain('Savings Account');
    expect(summary).toContain('$5,000.00');
    expect(summary).toContain('Income:');
    expect(summary).toContain('Social Security');
    expect(summary).toContain('$1,200.00/mo');
    expect(summary).toContain('Expenses:');
    expect(summary).toContain('Rent');
    expect(summary).toContain('$800.00/mo');
  });

  it('should include verification status for financial items', () => {
    const summary = generateCaseSummary(mockCaseData);

    expect(summary).toContain('(Verified)');
    expect(summary).toContain('(VR Pending)');
  });

  it('should include recent notes', () => {
    const summary = generateCaseSummary(mockCaseData);

    expect(summary).toContain('RECENT NOTES');
    expect(summary).toContain('Initial intake completed');
    expect(summary).toContain('Contacted for additional documentation');
    expect(summary).toContain('[General]');
    expect(summary).toContain('[Follow-up]');
  });

  it('should handle cases with no financial items', () => {
    const caseWithoutFinancials: CaseDisplay = {
      ...mockCaseData,
      caseRecord: {
        ...mockCaseData.caseRecord,
        financials: {
          resources: [],
          income: [],
          expenses: [],
        },
      },
    };

    const summary = generateCaseSummary(caseWithoutFinancials);

    expect(summary).toContain('No resources recorded');
    expect(summary).toContain('No income recorded');
    expect(summary).toContain('No expenses recorded');
  });

  it('should handle cases with no notes', () => {
    const caseWithoutNotes: CaseDisplay = {
      ...mockCaseData,
      caseRecord: {
        ...mockCaseData.caseRecord,
        notes: [],
      },
    };

    const summary = generateCaseSummary(caseWithoutNotes);

    expect(summary).toContain('No notes recorded');
  });

  it('should truncate long note content', () => {
    const longNoteContent = 'A'.repeat(150);
    const caseWithLongNote: CaseDisplay = {
      ...mockCaseData,
      caseRecord: {
        ...mockCaseData.caseRecord,
        notes: [
          {
            id: 'note-long',
            category: 'General',
            content: longNoteContent,
            createdAt: '2024-01-10T10:00:00Z',
            updatedAt: '2024-01-10T10:00:00Z',
          },
        ],
      },
    };

    const summary = generateCaseSummary(caseWithLongNote);

    expect(summary).toContain('...');
    expect(summary).not.toContain(longNoteContent);
  });

  it('should show most recent notes first', () => {
    const caseWithManyNotes: CaseDisplay = {
      ...mockCaseData,
      caseRecord: {
        ...mockCaseData.caseRecord,
        notes: [
          {
            id: 'note-1',
            category: 'General',
            content: 'Oldest note',
            createdAt: '2024-01-01T10:00:00Z',
            updatedAt: '2024-01-01T10:00:00Z',
          },
          {
            id: 'note-2',
            category: 'General',
            content: 'Middle note',
            createdAt: '2024-01-05T10:00:00Z',
            updatedAt: '2024-01-05T10:00:00Z',
          },
          {
            id: 'note-3',
            category: 'General',
            content: 'Newest note',
            createdAt: '2024-01-10T10:00:00Z',
            updatedAt: '2024-01-10T10:00:00Z',
          },
        ],
      },
    };

    const summary = generateCaseSummary(caseWithManyNotes);
    const newestIndex = summary.indexOf('Newest note');
    const middleIndex = summary.indexOf('Middle note');
    const oldestIndex = summary.indexOf('Oldest note');

    expect(newestIndex).toBeLessThan(middleIndex);
    expect(middleIndex).toBeLessThan(oldestIndex);
  });

  it('should include a generated timestamp', () => {
    const summary = generateCaseSummary(mockCaseData);

    expect(summary).toContain('Generated:');
  });

  it('should handle missing optional fields gracefully', () => {
    const minimalCase: CaseDisplay = {
      ...mockCaseData,
      name: '',
      mcn: '',
      person: {
        ...mockCaseData.person,
        email: '',
        phone: '',
      },
    };

    const summary = generateCaseSummary(minimalCase);

    expect(summary).toContain('Unnamed Case');
    expect(summary).toContain('Not assigned');
    expect(summary).toContain('Not provided');
  });
});
