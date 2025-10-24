export type AlertStatus = 'new' | 'in-progress' | 'acknowledged' | 'snoozed' | 'resolved';

export interface Alert {
  id: string;
  mcn?: string | null;
  caseId?: string | null;
  status: AlertStatus;
  description?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
