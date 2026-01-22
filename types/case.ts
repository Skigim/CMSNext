// Address interface
export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

// Mailing address interface with optional same as physical flag
export interface MailingAddress extends Address {
  sameAsPhysical: boolean;
}

export interface Relationship {
  type: string;
  name: string;
  phone: string;
}

/**
 * Represents a historical amount entry for a financial item.
 * Tracks amount values over time with date ranges and verification.
 */
export interface AmountHistoryEntry {
  id: string;
  /** The amount value for this period */
  amount: number;
  /** Start date of this amount period (YYYY-MM-DD format, typically 1st of month) */
  startDate: string;
  /** End date of this amount period (YYYY-MM-DD format). Null/undefined means ongoing. */
  endDate?: string | null;
  /** Verification source for this specific entry (e.g., "Bank Statement 05/2025") */
  verificationSource?: string;
  /** When this entry was created */
  createdAt: string;
}

// Person interface
export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  ssn: string;
  organizationId: string | null;
  livingArrangement: string;
  address: Address;
  mailingAddress: MailingAddress;
  authorizedRepIds: string[];
  familyMembers: string[];
  relationships?: Relationship[];
  status: string;
  createdAt: string;
  dateAdded: string;
}

// Financial item interface (resources, income, expenses)
export interface FinancialItem {
  id: string;
  name?: string; // For backward compatibility
  description: string;
  location?: string;
  accountNumber?: string;
  amount: number;
  /** Historical amount entries with date ranges and per-entry verification */
  amountHistory?: AmountHistoryEntry[];
  frequency?: string;
  owner?: string;
  verificationStatus: string;
  verificationSource?: string;
  notes?: string;
  dateAdded?: string;
  status?: 'VR Pending' | 'UI Pending' | 'Approved' | 'Denied' | 'In Progress' | 'Completed'; // For backward compatibility
  createdAt?: string;
  updatedAt?: string;
}

// Note interface
export interface Note {
  id: string;
  category: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Financials container
export interface Financials {
  resources: FinancialItem[];
  income: FinancialItem[];
  expenses: FinancialItem[];
}

export type AlertWorkflowStatus = 'new' | 'in-progress' | 'acknowledged' | 'snoozed' | 'resolved';

export interface AlertRecord {
  id: string;
  reportId?: string;
  /** Foreign key linking alert to a case. Alerts with caseId are deleted when their case is deleted. */
  caseId?: string;
  alertCode: string;
  alertType: string;
  alertDate: string;
  createdAt: string;
  updatedAt: string;
  mcNumber?: string | null;
  personName?: string;
  program?: string;
  region?: string;
  state?: string;
  source?: string;
  description?: string;
  status?: AlertWorkflowStatus;
  resolvedAt?: string | null;
  resolutionNotes?: string;
  metadata?: Record<string, string | undefined>;
}

// Voter form status options
export type VoterFormStatus = 'requested' | 'declined' | 'not_answered' | '';

// Contact method options
export type ContactMethod = 'mail' | 'text' | 'email';

export const CASE_STATUS = {
  Active: 'Active',
  Pending: 'Pending',
  Closed: 'Closed',
  Archived: 'Archived',
} as const;

export type CaseStatus = typeof CASE_STATUS[keyof typeof CASE_STATUS];

// Case record interface
export interface CaseRecord {
  id: string;
  mcn: string;
  applicationDate: string;
  caseType: string;
  /** Application type categorization (e.g., 'New', 'Renewal', 'Redetermination') */
  applicationType?: string;
  personId: string;
  spouseId: string;
  status: CaseStatus;
  description: string;
  priority: boolean;
  livingArrangement: string;
  withWaiver: boolean;
  admissionDate: string;
  organizationId: string;
  authorizedReps: string[];
  retroRequested: string;
  financials: Financials;
  notes: Note[];
  createdDate: string;
  updatedDate: string;

  // Intake checklist fields
  appValidated?: boolean;
  retroMonths?: string[];
  contactMethods?: ContactMethod[];
  agedDisabledVerified?: boolean;
  citizenshipVerified?: boolean;
  residencyVerified?: boolean;
  avsSubmitted?: boolean;
  interfacesReviewed?: boolean;
  reviewVRs?: boolean;
  reviewPriorBudgets?: boolean;
  reviewPriorNarr?: boolean;
  pregnancy?: boolean;
  avsConsentDate?: string;
  maritalStatus?: string;
  voterFormStatus?: VoterFormStatus;
}

// Main data structure
export interface CaseData {
  people: Person[];
  caseRecords: CaseRecord[];
  nextPersonId: number;
  nextCaseId: number;
  nextFinancialItemId: number;
  nextNoteId: number;
  showAllCases: boolean;
  showAllContacts: boolean;
  showAllPeople: boolean;
  showAllOrganizations: boolean;
  caseSortReversed: boolean;
  priorityFilterActive: boolean;
  contacts: any[];
  vrTemplates: any[];
  nextVrTemplateId: number;
  vrCategories: any[];
  vrRequests: any[];
  nextVrRequestId: number;
  vrDraftItems: any[];
  activeCase: string | null;
  isDataLoaded: boolean;
  meta: {
    source: string;
  };
}

// Type aliases for compatibility and clarity
export type CaseCategory = 'resources' | 'income' | 'expenses';

// Form data types
export interface NewPersonData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  ssn: string;
  organizationId?: string | null;
  livingArrangement: string;
  address: Address;
  mailingAddress: MailingAddress;
  authorizedRepIds?: string[];
  familyMembers?: string[];
  relationships?: Relationship[];
  status: string;
}

export interface NewCaseRecordData {
  mcn: string;
  applicationDate: string;
  caseType: string;
  /** Application type categorization (e.g., 'New', 'Renewal', 'Redetermination') */
  applicationType?: string;
  personId: string;
  spouseId?: string;
  status: CaseStatus;
  description: string;
  priority?: boolean;
  livingArrangement: string;
  withWaiver?: boolean;
  admissionDate: string;
  organizationId: string;
  authorizedReps?: string[];
  retroRequested?: string;

  // Intake checklist fields
  appValidated?: boolean;
  retroMonths?: string[];
  contactMethods?: ContactMethod[];
  agedDisabledVerified?: boolean;
  citizenshipVerified?: boolean;
  residencyVerified?: boolean;
  avsSubmitted?: boolean;
  interfacesReviewed?: boolean;
  reviewVRs?: boolean;
  reviewPriorBudgets?: boolean;
  reviewPriorNarr?: boolean;
  pregnancy?: boolean;
  avsConsentDate?: string;
  maritalStatus?: string;
  voterFormStatus?: VoterFormStatus;
}

export interface NewFinancialItemData {
  name?: string; // For backward compatibility
  description: string;
  location?: string;
  accountNumber?: string;
  amount: number;
  frequency?: string;
  owner?: string;
  verificationStatus: FinancialItem['verificationStatus'];
  verificationSource?: string;
  notes?: string;
  status?: FinancialItem['status']; // For backward compatibility
}

export interface NewNoteData {
  category: string;
  content: string;
}

// Helper interface for case display (combines case record with person data)
export interface CaseDisplay {
  id: string;
  name: string;
  mcn: string;
  status: CaseStatus;
  priority: boolean;
  createdAt: string;
  updatedAt: string;
  person: Person;
  caseRecord: CaseRecord;
  alerts?: AlertRecord[];
}

export interface StoredCase extends Omit<CaseDisplay, "caseRecord" | "alerts"> {
  caseRecord: Omit<CaseRecord, "financials" | "notes">;
  /** When true, case is pending archival review (set by auto-refresh on app load) */
  pendingArchival?: boolean;
}

export interface StoredFinancialItem extends FinancialItem {
  caseId: string;
  category: "resources" | "income" | "expenses";
}

export interface StoredNote extends Note {
  caseId: string;
}

export type CaseStatusUpdateHandler = (
  caseId: string,
  status: StoredCase["status"],
) => Promise<StoredCase | null> | StoredCase | null | void;