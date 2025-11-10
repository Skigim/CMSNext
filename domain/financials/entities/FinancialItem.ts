import { ValidationError } from '@/domain/common/errors/ValidationError';

export enum FinancialCategory {
  Resource = 'resources',
  Income = 'income',
  Expense = 'expenses',
}

export type FinancialVerificationStatus = string;

export interface FinancialItemSnapshot {
  id: string;
  caseId: string;
  category: FinancialCategory;
  description: string;
  amount: number;
  verificationStatus: FinancialVerificationStatus;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  // Legacy UI fields for backward compatibility
  frequency?: string;
  location?: string;
  accountNumber?: string;
  verificationSource?: string;
  notes?: string;
  owner?: string;
}

export interface FinancialItemCreateInput {
  id?: string;
  caseId: string;
  category: FinancialCategory;
  description: string;
  amount: number;
  verificationStatus?: FinancialVerificationStatus;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  metadata?: Record<string, unknown>;
  // Legacy UI fields for backward compatibility
  frequency?: string;
  location?: string;
  accountNumber?: string;
  verificationSource?: string;
  notes?: string;
  owner?: string;
}

/**
 * Domain entity representing a financial item associated with a case.
 * Encapsulates validation and business rules for financial tracking.
 */
export class FinancialItem {
  private props: FinancialItemSnapshot;

  private constructor(props: FinancialItemSnapshot) {
    this.props = { ...props, metadata: FinancialItem.cloneMetadata(props.metadata) };
    this.validate();
  }

  /**
   * Factory for creating a new financial item with generated identifiers and timestamps.
   */
  static create(input: FinancialItemCreateInput): FinancialItem {
    const now = new Date();
    return new FinancialItem({
      id: input.id?.trim() || FinancialItem.generateId(),
      caseId: input.caseId.trim(),
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      verificationStatus: input.verificationStatus ?? 'Needs VR',
      createdAt: FinancialItem.normalizeDate(input.createdAt ?? now),
      updatedAt: FinancialItem.normalizeDate(input.updatedAt ?? now),
      metadata: FinancialItem.cloneMetadata(input.metadata ?? {}),
      // Include legacy fields if provided
      frequency: input.frequency?.trim() || undefined,
      location: input.location?.trim() || undefined,
      accountNumber: input.accountNumber?.trim() || undefined,
      verificationSource: input.verificationSource?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      owner: input.owner?.trim() || undefined,
    });
  }

  /**
   * Reconstruct an existing financial item from persisted storage.
   */
  static rehydrate(snapshot: FinancialItemSnapshot): FinancialItem {
    return new FinancialItem({
      id: snapshot.id,
      caseId: snapshot.caseId,
      category: snapshot.category,
      description: snapshot.description,
      amount: snapshot.amount,
      verificationStatus: snapshot.verificationStatus,
      createdAt: FinancialItem.normalizeDate(snapshot.createdAt),
      updatedAt: FinancialItem.normalizeDate(snapshot.updatedAt),
      metadata: FinancialItem.cloneMetadata(snapshot.metadata ?? {}),
      // Preserve legacy fields from storage
      frequency: snapshot.frequency,
      location: snapshot.location,
      accountNumber: snapshot.accountNumber,
      verificationSource: snapshot.verificationSource,
      notes: snapshot.notes,
      owner: snapshot.owner,
    });
  }

  /**
   * Clone the entity to maintain immutability guarantees.
   */
  clone(): FinancialItem {
    return FinancialItem.rehydrate(this.toJSON());
  }

  /**
   * Serialize to a plain snapshot suitable for persistence.
   */
  toJSON(): FinancialItemSnapshot {
    return {
      id: this.id,
      caseId: this.caseId,
      category: this.category,
      description: this.description,
      amount: this.amount,
      verificationStatus: this.verificationStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: FinancialItem.cloneMetadata(this.metadata),
      // Include legacy fields in serialization
      frequency: this.frequency,
      location: this.location,
      accountNumber: this.accountNumber,
      verificationSource: this.verificationSource,
      notes: this.notes,
      owner: this.owner,
    };
  }

  private validate(): void {
    if (!this.props.id?.trim()) {
      throw new ValidationError('FinancialItem ID is required');
    }
    if (!this.props.caseId?.trim()) {
      throw new ValidationError('Case ID is required');
    }
    if (!this.props.description?.trim()) {
      throw new ValidationError('Description is required');
    }
    if (typeof this.props.amount !== 'number' || this.props.amount < 0) {
      throw new ValidationError('Amount must be a non-negative number');
    }
    if (!FinancialItem.isValidIsoDate(this.props.createdAt)) {
      throw new ValidationError('FinancialItem createdAt must be a valid ISO-8601 timestamp');
    }
    if (!FinancialItem.isValidIsoDate(this.props.updatedAt)) {
      throw new ValidationError('FinancialItem updatedAt must be a valid ISO-8601 timestamp');
    }
    if (typeof this.props.metadata !== 'object' || this.props.metadata === null) {
      throw new ValidationError('FinancialItem metadata must be an object');
    }
  }

  // Getters for all properties
  get id(): string {
    return this.props.id;
  }

  get caseId(): string {
    return this.props.caseId;
  }

  get category(): FinancialCategory {
    return this.props.category;
  }

  get description(): string {
    return this.props.description;
  }

  get amount(): number {
    return this.props.amount;
  }

  get verificationStatus(): FinancialVerificationStatus {
    return this.props.verificationStatus;
  }

  get createdAt(): string {
    return this.props.createdAt;
  }

  get updatedAt(): string {
    return this.props.updatedAt;
  }

  get metadata(): Record<string, unknown> {
    return FinancialItem.cloneMetadata(this.props.metadata);
  }

  get frequency(): string | undefined {
    return this.props.frequency;
  }

  get location(): string | undefined {
    return this.props.location;
  }

  get accountNumber(): string | undefined {
    return this.props.accountNumber;
  }

  get verificationSource(): string | undefined {
    return this.props.verificationSource;
  }

  get notes(): string | undefined {
    return this.props.notes;
  }

  get owner(): string | undefined {
    return this.props.owner;
  }

  /**
   * Apply updates immutably, returning a new FinancialItem instance.
   * Used for updates that preserve entity integrity and timestamps.
   */
  applyUpdates(updates: Partial<Omit<FinancialItemSnapshot, 'id' | 'caseId' | 'createdAt'>>): FinancialItem {
    return FinancialItem.rehydrate({
      ...this.toJSON(),
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  private static normalizeDate(value: string | Date): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (!FinancialItem.isValidIsoDate(value)) {
      throw new ValidationError('Invalid ISO date provided for financial item timestamp');
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
    return `financial-${timestamp}-${randomSegment}`;
  }
}

export default FinancialItem;
