import type { FinancialItem } from '@/domain/financials/entities/FinancialItem';
import type { IRepository } from './IRepository';

export interface IFinancialRepository extends IRepository<FinancialItem, string> {
  getByCaseId(caseId: string): Promise<FinancialItem[]>;
  getByCategory(category: string): Promise<FinancialItem[]>;
}
