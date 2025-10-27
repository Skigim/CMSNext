import { ValidationError } from '@/domain/common/errors/ValidationError';

export type AlertStatus = 'new' | 'in-progress' | 'acknowledged' | 'snoozed' | 'resolved';

export interface AlertSnapshot {
  id: string;
  mcn?: string | null;
  caseId?: string | null;
  status: AlertStatus;
  description?: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface AlertCreateInput {
  id?: string;
  mcn?: string | null;
  caseId?: string | null;
  status?: AlertStatus;
  description?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  metadata?: Record<string, unknown>;
}

/**
 * Domain entity representing an alert in the system.
 * Encapsulates validation and business rules for alert management.
 */
export class Alert {
  private props: AlertSnapshot;

  private constructor(props: AlertSnapshot) {
    this.props = { ...props, metadata: Alert.cloneMetadata(props.metadata) };
    this.validate();
  }

  /**
   * Factory for creating a new alert with generated identifiers and timestamps.
   */
  static create(input: AlertCreateInput): Alert {
    const now = new Date();
    return new Alert({
      id: input.id?.trim() || Alert.generateId(),
      mcn: input.mcn?.trim() || null,
      caseId: input.caseId?.trim() || null,
      status: input.status ?? 'new',
      description: input.description?.trim(),
      createdAt: Alert.normalizeDate(input.createdAt ?? now),
      updatedAt: Alert.normalizeDate(input.updatedAt ?? now),
      metadata: Alert.cloneMetadata(input.metadata ?? {}),
    });
  }

  /**
   * Reconstruct an existing alert from persisted storage.
   */
  static rehydrate(snapshot: AlertSnapshot): Alert {
    return new Alert({
      id: snapshot.id,
      mcn: snapshot.mcn,
      caseId: snapshot.caseId,
      status: snapshot.status,
      description: snapshot.description,
      createdAt: Alert.normalizeDate(snapshot.createdAt),
      updatedAt: Alert.normalizeDate(snapshot.updatedAt),
      metadata: Alert.cloneMetadata(snapshot.metadata ?? {}),
    });
  }

  /**
   * Clone the entity to maintain immutability guarantees.
   */
  clone(): Alert {
    return Alert.rehydrate(this.toJSON());
  }

  /**
   * Serialize to a plain snapshot suitable for persistence.
   */
  toJSON(): AlertSnapshot {
    return {
      id: this.id,
      mcn: this.mcn,
      caseId: this.caseId,
      status: this.status,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: Alert.cloneMetadata(this.metadata),
    };
  }

  private validate(): void {
    if (!this.props.id?.trim()) {
      throw new ValidationError('Alert ID is required');
    }
    const validStatuses: AlertStatus[] = ['new', 'in-progress', 'acknowledged', 'snoozed', 'resolved'];
    if (!validStatuses.includes(this.props.status)) {
      throw new ValidationError(`Invalid alert status: ${this.props.status}`);
    }
    if (!Alert.isValidIsoDate(this.props.createdAt)) {
      throw new ValidationError('Alert createdAt must be a valid ISO-8601 timestamp');
    }
    if (!Alert.isValidIsoDate(this.props.updatedAt)) {
      throw new ValidationError('Alert updatedAt must be a valid ISO-8601 timestamp');
    }
    if (typeof this.props.metadata !== 'object' || this.props.metadata === null) {
      throw new ValidationError('Alert metadata must be an object');
    }
  }

  // Getters for all properties
  get id(): string {
    return this.props.id;
  }

  get mcn(): string | null | undefined {
    return this.props.mcn;
  }

  get caseId(): string | null | undefined {
    return this.props.caseId;
  }

  get status(): AlertStatus {
    return this.props.status;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get createdAt(): string {
    return this.props.createdAt;
  }

  get updatedAt(): string {
    return this.props.updatedAt;
  }

  get metadata(): Record<string, unknown> {
    return Alert.cloneMetadata(this.props.metadata);
  }

  private static normalizeDate(value: string | Date): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (!Alert.isValidIsoDate(value)) {
      throw new ValidationError('Invalid ISO date provided for alert timestamp');
    }

    return new Date(value).toISOString();
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
    return `alert-${timestamp}-${randomSegment}`;
  }
}

export default Alert;
