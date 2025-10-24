import type { Case } from '@/domain/cases/entities/Case';
import type { IRepository } from './IRepository';

export interface ICaseRepository extends IRepository<Case, string> {
  findByMCN(mcn: string): Promise<Case | null>;
  searchCases(query: string): Promise<Case[]>;
}
