import { DomainError } from '@/domain/common/errors/DomainError';
import { ValidationError } from '@/domain/common/errors/ValidationError';
import { CASE_STATUS, CASE_STATUS_VALUES, type CaseStatus } from '@/types/case';
import { Person, type PersonProps, type PersonSnapshot } from './Person';

export type CaseMetadata = Record<string, unknown>;

export interface CaseSnapshot {
  id: string;
  mcn: string;
  name: string;
  status: CaseStatus;
  personId: string;
  createdAt: string;
  updatedAt: string;
  metadata: CaseMetadata;
  person?: PersonSnapshot;
}

export interface CaseCreateInput {
  id?: string;
  mcn: string;
  name: string;
  personId: string;
  metadata?: CaseMetadata;
  status?: CaseStatus;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  person?: Person | PersonProps | PersonSnapshot;
}

type InternalCaseProps = CaseSnapshot & { person?: Person };

/**
 * Aggregate root representing a case within the CMS domain.
 * Encapsulates validation and business rules for status transitions.
 */
export class Case {
  private props: InternalCaseProps;

  private constructor(props: InternalCaseProps) {
    this.props = {
      ...props,
      metadata: Case.cloneMetadata(props.metadata),
      person: props.person?.clone(),
    };

    this.validate();
  }

  /**
   * Factory for creating a new case with generated identifiers and timestamps.
   */
  static create(input: CaseCreateInput): Case {
    const now = new Date();
    const person = Case.normalizePerson(input.person);
    const personId = person ? person.id : Case.normalizePersonId(input.personId);

    return new Case({
      id: input.id?.trim() || Case.generateId(),
      mcn: Case.normalizeMcn(input.mcn),
      name: Case.normalizeName(input.name),
  status: input.status ?? CASE_STATUS.Active,
      personId,
      createdAt: Case.normalizeDate(input.createdAt ?? now),
      updatedAt: Case.normalizeDate(input.updatedAt ?? now),
      metadata: Case.cloneMetadata(input.metadata ?? {}),
      person,
    });
  }

  /**
   * Reconstruct an existing case from persisted storage.
   */
  static rehydrate(snapshot: CaseSnapshot | (CaseSnapshot & { person?: Person | PersonSnapshot })): Case {
    const person = Case.normalizePerson(snapshot.person);
    return new Case({
      id: snapshot.id,
      mcn: Case.normalizeMcn(snapshot.mcn),
      name: Case.normalizeName(snapshot.name),
      status: snapshot.status,
      personId: Case.normalizePersonId(snapshot.personId),
      createdAt: Case.normalizeDate(snapshot.createdAt),
      updatedAt: Case.normalizeDate(snapshot.updatedAt),
      metadata: Case.cloneMetadata(snapshot.metadata ?? {}),
      person,
    });
  }

  /**
   * Clone the aggregate root to maintain immutability guarantees for callers.
   */
  clone(): Case {
    return Case.rehydrate(this.toJSON());
  }

  /**
   * Serialize the aggregate to a plain snapshot suitable for persistence.
   */
  toJSON(): CaseSnapshot {
    return {
      id: this.id,
      mcn: this.mcn,
      name: this.name,
      status: this.status,
      personId: this.personId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: Case.cloneMetadata(this.metadata),
  person: this.props.person ? this.props.person.toJSON() : undefined,
    };
  }

  /** Unique case identifier. */
  get id(): string {
    return this.props.id;
  }

  /** Medicaid case number. */
  get mcn(): string {
    return this.props.mcn;
  }

  /** Case display name. */
  get name(): string {
    return this.props.name;
  }

  /** Current lifecycle status. */
  get status(): CaseStatus {
    return this.props.status;
  }

  /** Linked person identifier. */
  get personId(): string {
    return this.props.personId;
  }

  /** Creation timestamp (ISO 8601). */
  get createdAt(): string {
    return this.props.createdAt;
  }

  /** Last update timestamp (ISO 8601). */
  get updatedAt(): string {
    return this.props.updatedAt;
  }

  /** Optional metadata used for compatibility during migration. */
  get metadata(): CaseMetadata {
    return Case.cloneMetadata(this.props.metadata);
  }

  /** Optional associated person details. */
  get person(): Person | undefined {
    return this.props.person ? this.props.person.clone() : undefined;
  }

  /** Update the case display name, applying validation. */
  updateName(name: string): void {
    this.props.name = Case.normalizeName(name);
    this.touchUpdatedAt();
  }

  /**
   * Update the case status following the allowed transitions.
   */
  updateStatus(newStatus: CaseStatus): void {
    if (!this.canTransitionTo(newStatus)) {
      throw new DomainError(`Cannot transition from ${this.status} to ${newStatus}`);
    }

    this.props.status = newStatus;
    this.touchUpdatedAt();
  }

  /**
   * Archive the case. Only closed cases may be archived.
   */
  archive(): void {
    if (this.status !== CASE_STATUS.Closed) {
      throw new DomainError('Cannot archive non-closed case');
    }

    this.props.status = CASE_STATUS.Archived;
    this.touchUpdatedAt();
  }

  /**
   * Validate all invariants for the aggregate.
   */
  validate(): void {
    if (!this.props.id.trim()) {
      throw new ValidationError('Case id cannot be empty');
    }

    if (!Case.isValidMcn(this.props.mcn)) {
      throw new ValidationError('Case MCN must start with MC or MCN followed by at least 3 alphanumeric or dash characters (e.g., MCN-1234, MC-5678)');
    }

    if (!this.props.name.trim()) {
      throw new ValidationError('Case name cannot be empty');
    }

    if (!CASE_STATUS_VALUES.includes(this.props.status)) {
      throw new ValidationError(`Invalid case status: ${this.props.status}`);
    }

    if (!this.props.personId.trim()) {
      throw new ValidationError('Case personId cannot be empty');
    }

    if (!Case.isValidIsoDate(this.props.createdAt)) {
      throw new ValidationError('Case createdAt must be a valid ISO-8601 timestamp');
    }

    if (!Case.isValidIsoDate(this.props.updatedAt)) {
      throw new ValidationError('Case updatedAt must be a valid ISO-8601 timestamp');
    }

    const createdAtMs = Date.parse(this.props.createdAt);
    const updatedAtMs = Date.parse(this.props.updatedAt);
    if (updatedAtMs < createdAtMs) {
      throw new ValidationError('Case updatedAt cannot be before createdAt');
    }

    if (typeof this.props.metadata !== 'object' || this.props.metadata === null) {
      throw new ValidationError('Case metadata must be an object');
    }
  }

  private touchUpdatedAt(): void {
    this.props.updatedAt = new Date().toISOString();
  }

  private canTransitionTo(newStatus: CaseStatus): boolean {
    const validTransitions: Record<CaseStatus, CaseStatus[]> = {
      [CASE_STATUS.Active]: [CASE_STATUS.Pending, CASE_STATUS.Closed],
      [CASE_STATUS.Pending]: [CASE_STATUS.Active, CASE_STATUS.Closed],
      [CASE_STATUS.Closed]: [CASE_STATUS.Archived],
      [CASE_STATUS.Archived]: [],
    };

    return validTransitions[this.status].includes(newStatus);
  }

  private static normalizePerson(person?: Person | PersonProps | PersonSnapshot): Person | undefined {
    if (!person) {
      return undefined;
    }

    if (person instanceof Person) {
      return person.clone();
    }

    if (typeof person === 'object' && 'id' in person && ('fullName' in person || 'name' in person)) {
      return Person.rehydrate(person as PersonSnapshot);
    }

    return Person.create(person as PersonProps);
  }

  private static normalizeMcn(mcn: string): string {
    return mcn.trim().toUpperCase();
  }

  private static normalizeName(name: string): string {
    return name.trim();
  }

  private static normalizePersonId(personId: string): string {
    return personId.trim();
  }

  private static normalizeDate(value: string | Date): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (!Case.isValidIsoDate(value)) {
      throw new ValidationError('Invalid ISO date provided for case timestamp');
    }

    return new Date(value).toISOString();
  }

  private static cloneMetadata(metadata: CaseMetadata): CaseMetadata {
    return JSON.parse(JSON.stringify(metadata ?? {}));
  }

  private static isValidIsoDate(value: string): boolean {
    return Number.isFinite(Date.parse(value));
  }

  private static isValidMcn(value: string): boolean {
    // Allow MCN/MC prefix or plain numbers (at least 3 characters)
    return /^(MCN?[A-Z0-9-]{3,}|[0-9]{3,})$/i.test(value);
  }

  private static generateId(): string {
    const timestamp = Date.now().toString(36);
    const randomSegment = Math.random().toString(36).slice(2, 10);
    return `case-${timestamp}-${randomSegment}`;
  }
}

export default Case;
