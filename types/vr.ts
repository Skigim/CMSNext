/**
 * VR (Verification Request) Script and Generation Types
 * 
 * VR Scripts are user-configurable templates with placeholder fields
 * that get filled from financial item and case data.
 */

/**
 * A VR Script template configured by the user.
 * Scripts are stored in CategoryConfig and can be applied to any financial item.
 */
export interface VRScript {
  /** Unique identifier for the script */
  id: string;
  /** Display name for the script (e.g., "Bank Account VR", "Income VR") */
  name: string;
  /** Template text with placeholders like {accountNumber}, {amount}, etc. */
  template: string;
  /** When this script was created */
  createdAt: string;
  /** When this script was last modified */
  updatedAt: string;
}

/**
 * All available placeholder fields that can be used in VR templates.
 * These are derived from FinancialItem, AmountHistoryEntry, and Case data.
 */
export const VR_PLACEHOLDER_FIELDS = {
  // Financial item fields
  description: { label: "Description", category: "Financial Item" },
  accountNumber: { label: "Account Number", category: "Financial Item" },
  amount: { label: "Current Amount", category: "Financial Item" },
  location: { label: "Location/Institution", category: "Financial Item" },
  owner: { label: "Account Owner", category: "Financial Item" },
  frequency: { label: "Frequency", category: "Financial Item" },
  verificationStatus: { label: "Verification Status", category: "Financial Item" },
  verificationSource: { label: "Verification Source", category: "Financial Item" },
  dateAdded: { label: "Date Added", category: "Financial Item" },
  itemNotes: { label: "Item Notes", category: "Financial Item" },
  itemType: { label: "Item Type", category: "Financial Item" },
  
  // Amount history fields (from most recent entry)
  lastUpdated: { label: "Last Updated Date", category: "Amount History" },
  lastVerified: { label: "Last Verified Date", category: "Amount History" },
  historyVerificationSource: { label: "History Verification Source", category: "Amount History" },
  
  // Case fields
  caseName: { label: "Client Name", category: "Case" },
  caseNumber: { label: "Case Number (MCN)", category: "Case" },
  caseType: { label: "Case Type", category: "Case" },
  applicationDate: { label: "Application Date", category: "Case" },
  caseStatus: { label: "Case Status", category: "Case" },
  
  // Person fields
  clientFirstName: { label: "Client First Name", category: "Person" },
  clientLastName: { label: "Client Last Name", category: "Person" },
  clientPhone: { label: "Client Phone", category: "Person" },
  clientEmail: { label: "Client Email", category: "Person" },
  clientSSN: { label: "Client SSN", category: "Person" },
  clientDOB: { label: "Client Date of Birth", category: "Person" },
  clientAddress: { label: "Client Address", category: "Person" },
  
  // Date placeholders (supports +/- offset syntax, e.g., {currentDate+90}, {applicationDate+30})
  currentDate: { label: "Current Date", category: "System" },
} as const;

export type VRPlaceholderField = keyof typeof VR_PLACEHOLDER_FIELDS;

/**
 * Context data passed to the VR renderer for placeholder substitution.
 */
export interface VRRenderContext {
  // Financial item data
  description?: string;
  accountNumber?: string;
  amount?: number;
  location?: string;
  owner?: string;
  frequency?: string;
  verificationStatus?: string;
  verificationSource?: string;
  dateAdded?: string;
  itemNotes?: string;
  itemType?: string;
  
  // Amount history
  lastUpdated?: string;
  lastVerified?: string;
  historyVerificationSource?: string;
  
  // Case data
  caseName?: string;
  caseNumber?: string;
  caseType?: string;
  applicationDate?: string;
  caseStatus?: string;
  
  // Person data
  clientFirstName?: string;
  clientLastName?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientSSN?: string;
  clientDOB?: string;
  clientAddress?: string;
  
  // System
  currentDate?: string;
}

/**
 * A rendered VR for a specific financial item.
 */
export interface RenderedVR {
  /** The financial item ID this VR was generated from */
  itemId: string;
  /** The script ID used to generate this VR */
  scriptId: string;
  /** The final rendered text with all placeholders filled */
  text: string;
}
