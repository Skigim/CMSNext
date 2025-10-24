export interface ActivityEvent {
  id: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  changes: Record<string, unknown>;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
