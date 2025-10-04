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
  frequency?: string;
  owner?: string;
  verificationStatus: 'Needs VR' | 'VR Pending' | 'AVS Pending' | 'Verified';
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

export type AlertSeverity = 'Low' | 'Medium' | 'High' | 'Critical' | 'Info';

export type AlertWorkflowStatus = 'new' | 'in-progress' | 'acknowledged' | 'snoozed' | 'resolved';

export interface AlertRecord {
  id: string;
  reportId?: string;
  alertCode: string;
  alertType: string;
  severity: AlertSeverity;
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

export type CaseStatus = string;

// Case record interface
export interface CaseRecord {
  id: string;
  mcn: string;
  applicationDate: string;
  caseType: string;
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
  status: string;
}

export interface NewCaseRecordData {
  mcn: string;
  applicationDate: string;
  caseType: string;
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

// Legacy compatibility types (for gradual migration)
export interface CaseItem extends FinancialItem {}
export interface NewCaseItemData extends NewFinancialItemData {}

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

export type CaseStatusUpdateHandler = (
  caseId: string,
  status: CaseDisplay["status"],
) => Promise<CaseDisplay | null> | CaseDisplay | null | void;