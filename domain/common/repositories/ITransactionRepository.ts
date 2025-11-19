import { Case } from '@/domain/cases/entities/Case';
import { FinancialItem } from '@/domain/financials/entities/FinancialItem';
import { Note } from '@/domain/notes/entities/Note';
import { Alert } from '@/domain/alerts/entities/Alert';
import { ActivityEvent } from '@/domain/activity/entities/ActivityEvent';

export type TransactionDomain = 'cases' | 'financials' | 'notes' | 'alerts' | 'activities';

export type TransactionOperation = 
  | { type: 'save'; domain: 'cases'; entity: Case }
  | { type: 'save'; domain: 'financials'; entity: FinancialItem }
  | { type: 'save'; domain: 'notes'; entity: Note }
  | { type: 'save'; domain: 'alerts'; entity: Alert }
  | { type: 'save'; domain: 'activities'; entity: ActivityEvent }
  | { type: 'delete'; domain: TransactionDomain; id: string };

export interface ITransactionRepository {
  runTransaction(operations: TransactionOperation[]): Promise<void>;
}
