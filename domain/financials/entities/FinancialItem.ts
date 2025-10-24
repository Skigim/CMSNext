export enum FinancialCategory {
  Resource = 'resources',
  Income = 'income',
  Expense = 'expenses',
}

export type FinancialVerificationStatus =
  | 'Needs VR'
  | 'VR Pending'
  | 'AVS Pending'
  | 'Verified';

export interface FinancialItem {
  id: string;
  caseId: string;
  category: FinancialCategory;
  description: string;
  amount: number;
  verificationStatus: FinancialVerificationStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
