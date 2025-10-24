import type { ActivityEvent } from '@/domain/activity/entities/ActivityEvent';
import type { IRepository } from './IRepository';

export interface IActivityRepository extends IRepository<ActivityEvent, string> {
  getByAggregateId(aggregateId: string): Promise<ActivityEvent[]>;
  getRecent(limit: number): Promise<ActivityEvent[]>;
}
