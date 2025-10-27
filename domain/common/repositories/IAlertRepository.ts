import type { Alert } from '@/domain/alerts/entities/Alert';
import type { IRepository } from './IRepository';

export interface IAlertRepository extends IRepository<Alert, string> {
  findByMCN(mcn: string): Promise<Alert[]>;
  getUnmatched(): Promise<Alert[]>;
}
