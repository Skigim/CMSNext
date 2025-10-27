import { ValidationError } from '@/domain/common/errors/ValidationError';

export interface ActivityEventSnapshot {
  id: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  changes: Record<string, unknown>;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface ActivityEventCreateInput {
  id?: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  changes: Record<string, unknown>;
  timestamp?: string | Date;
  metadata?: Record<string, unknown>;
}

/**
 * Domain entity representing an activity event in the system.
 * Encapsulates validation and business rules for activity tracking.
 */
export class ActivityEvent {
  private props: ActivityEventSnapshot;

  private constructor(props: ActivityEventSnapshot) {
    this.props = {
      ...props,
      changes: ActivityEvent.cloneChanges(props.changes),
      metadata: ActivityEvent.cloneMetadata(props.metadata),
    };
    this.validate();
  }

  /**
   * Factory for creating a new activity event with generated identifiers and timestamps.
   */
  static create(input: ActivityEventCreateInput): ActivityEvent {
    const now = new Date();
    return new ActivityEvent({
      id: input.id?.trim() || ActivityEvent.generateId(),
      eventType: input.eventType.trim(),
      aggregateId: input.aggregateId.trim(),
      aggregateType: input.aggregateType.trim(),
      changes: ActivityEvent.cloneChanges(input.changes),
      timestamp: ActivityEvent.normalizeDate(input.timestamp ?? now),
      metadata: ActivityEvent.cloneMetadata(input.metadata ?? {}),
    });
  }

  /**
   * Reconstruct an existing activity event from persisted storage.
   */
  static rehydrate(snapshot: ActivityEventSnapshot): ActivityEvent {
    return new ActivityEvent({
      id: snapshot.id,
      eventType: snapshot.eventType,
      aggregateId: snapshot.aggregateId,
      aggregateType: snapshot.aggregateType,
      changes: ActivityEvent.cloneChanges(snapshot.changes),
      timestamp: ActivityEvent.normalizeDate(snapshot.timestamp),
      metadata: ActivityEvent.cloneMetadata(snapshot.metadata ?? {}),
    });
  }

  /**
   * Clone the entity to maintain immutability guarantees.
   */
  clone(): ActivityEvent {
    return ActivityEvent.rehydrate(this.toJSON());
  }

  /**
   * Serialize to a plain snapshot suitable for persistence.
   */
  toJSON(): ActivityEventSnapshot {
    return {
      id: this.id,
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      changes: ActivityEvent.cloneChanges(this.changes),
      timestamp: this.timestamp,
      metadata: ActivityEvent.cloneMetadata(this.metadata),
    };
  }

  private validate(): void {
    if (!this.props.id?.trim()) {
      throw new ValidationError('ActivityEvent ID is required');
    }
    if (!this.props.eventType?.trim()) {
      throw new ValidationError('Event type is required');
    }
    if (!this.props.aggregateId?.trim()) {
      throw new ValidationError('Aggregate ID is required');
    }
    if (!this.props.aggregateType?.trim()) {
      throw new ValidationError('Aggregate type is required');
    }
    if (!ActivityEvent.isValidIsoDate(this.props.timestamp)) {
      throw new ValidationError('ActivityEvent timestamp must be a valid ISO-8601 timestamp');
    }
    if (typeof this.props.changes !== 'object' || this.props.changes === null) {
      throw new ValidationError('ActivityEvent changes must be an object');
    }
    if (typeof this.props.metadata !== 'object' || this.props.metadata === null) {
      throw new ValidationError('ActivityEvent metadata must be an object');
    }
  }

  // Getters for all properties
  get id(): string {
    return this.props.id;
  }

  get eventType(): string {
    return this.props.eventType;
  }

  get aggregateId(): string {
    return this.props.aggregateId;
  }

  get aggregateType(): string {
    return this.props.aggregateType;
  }

  get changes(): Record<string, unknown> {
    return ActivityEvent.cloneChanges(this.props.changes);
  }

  get timestamp(): string {
    return this.props.timestamp;
  }

  get metadata(): Record<string, unknown> {
    return ActivityEvent.cloneMetadata(this.props.metadata);
  }

  private static normalizeDate(value: string | Date): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (!ActivityEvent.isValidIsoDate(value)) {
      throw new ValidationError('Invalid ISO date provided for activity event timestamp');
    }

    return new Date(value).toISOString();
  }

  private static cloneChanges(changes: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(changes ?? {}));
  }

  private static cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(metadata ?? {}));
  }

  private static isValidIsoDate(value: string): boolean {
    return Number.isFinite(Date.parse(value));
  }

  private static generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const timestamp = Date.now().toString(36);
    const randomSegment = Math.random().toString(36).slice(2, 10);
    return `activity-${timestamp}-${randomSegment}`;
  }
}

export default ActivityEvent;
