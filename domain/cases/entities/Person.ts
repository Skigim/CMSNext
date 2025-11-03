import { ValidationError } from '@/domain/common/errors/ValidationError';

export interface ContactInfo {
  email?: string;
  phone?: string;
}

export interface PersonProps {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | Date;
  contactInfo?: ContactInfo;
  metadata?: Record<string, unknown>;
}

export interface PersonSnapshot {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  contactInfo: ContactInfo;
  metadata: Record<string, unknown>;
  /** Legacy support for persisted structures that only stored a single name field. */
  name?: string;
}

type InternalPersonState = PersonSnapshot;

/**
 * Immutable value object representing person details associated with a case.
 */
export class Person {
  private readonly state: InternalPersonState;

  private constructor(state: InternalPersonState) {
    this.state = {
      ...state,
      contactInfo: Person.cloneContactInfo(state.contactInfo),
      metadata: Person.cloneMetadata(state.metadata),
    };

    this.validate();
  }

  /**
   * Create a new person value object, generating identifiers and normalising props as needed.
   */
  static create(props: PersonProps): Person {
    return new Person({
      id: Person.normalizeId(props.id),
      firstName: Person.normalizeName(props.firstName),
      lastName: Person.normalizeName(props.lastName),
      fullName: Person.composeFullName(props.firstName, props.lastName),
      dateOfBirth: Person.normalizeDate(props.dateOfBirth),
      contactInfo: Person.normalizeContactInfo(props.contactInfo),
      metadata: Person.cloneMetadata(props.metadata ?? {}),
    });
  }

  /**
   * Recreate a person from a persisted snapshot.
   */
  static rehydrate(snapshot: PersonSnapshot): Person {
    let firstName = Person.normalizeName(snapshot.firstName ?? '');
    let lastName = Person.normalizeName(snapshot.lastName ?? '');

    if ((!firstName || !lastName) && snapshot.name) {
      const parts = snapshot.name.trim().split(/\s+/);
      if (!firstName && parts.length > 0) {
        firstName = parts[0];
      }
      if (!lastName && parts.length > 1) {
        lastName = parts.slice(1).join(' ');
      }
    }

    const derivedFullName = snapshot.fullName
      || snapshot.name
      || Person.composeFullName(firstName, lastName);

    return new Person({
      id: snapshot.id,
      firstName,
      lastName,
      fullName: derivedFullName,
      dateOfBirth: Person.normalizeDate(snapshot.dateOfBirth),
      contactInfo: Person.cloneContactInfo(snapshot.contactInfo ?? {}),
      metadata: Person.cloneMetadata(snapshot.metadata ?? {}),
    });
  }

  clone(): Person {
    return Person.rehydrate(this.toJSON());
  }

  /**
   * Serialize the value object to a plain snapshot.
   */
  toJSON(): PersonSnapshot {
    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.fullName,
      dateOfBirth: this.dateOfBirth,
      contactInfo: Person.cloneContactInfo(this.contactInfo),
      metadata: Person.cloneMetadata(this.metadata),
    };
  }

  get id(): string {
    return this.state.id;
  }

  get firstName(): string {
    return this.state.firstName;
  }

  get lastName(): string {
    return this.state.lastName;
  }

  get fullName(): string {
    return this.state.fullName;
  }

  get dateOfBirth(): string {
    return this.state.dateOfBirth;
  }

  get contactInfo(): ContactInfo {
    return Person.cloneContactInfo(this.state.contactInfo);
  }

  get metadata(): Record<string, unknown> {
    return Person.cloneMetadata(this.state.metadata);
  }

  private validate(): void {
    if (!this.state.firstName.trim()) {
      throw new ValidationError('Person first name cannot be empty');
    }

    if (!this.state.lastName.trim()) {
      throw new ValidationError('Person last name cannot be empty');
    }

    if (this.state.dateOfBirth && !Person.isValidIsoDate(this.state.dateOfBirth)) {
      throw new ValidationError('Person date of birth must be a valid ISO-8601 date string');
    }

    const { email, phone } = this.state.contactInfo;
    if (email && !Person.emailPattern.test(email)) {
      throw new ValidationError('Person email address is invalid');
    }

    if (phone && !Person.phonePattern.test(Person.normalizePhone(phone))) {
      throw new ValidationError('Person phone number is invalid');
    }

    if (typeof this.state.metadata !== 'object' || this.state.metadata === null) {
      throw new ValidationError('Person metadata must be an object');
    }
  }

  private static normalizeId(id?: string): string {
    const trimmed = id?.trim();
    if (trimmed) {
      return trimmed;
    }

    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `person-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private static normalizeName(value: string): string {
    return value.trim();
  }

  private static composeFullName(firstName: string, lastName: string): string {
    const first = `${firstName}`.trim();
    const last = `${lastName}`.trim();

    if (first && last) {
      return `${first} ${last}`;
    }

    return first || last;
  }

  private static normalizeDate(value: string | Date): string {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    // Accept strict YYYY-MM-DD format or full ISO 8601 timestamps
    const strictDatePattern = /^\d{4}-\d{2}-\d{2}$/;
    const isoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    
    if (!strictDatePattern.test(value) && !isoTimestampPattern.test(value)) {
      throw new ValidationError('Person date of birth must be in YYYY-MM-DD format or ISO 8601 timestamp');
    }

    if (!Person.isValidIsoDate(value)) {
      throw new ValidationError('Person date of birth must be a valid date');
    }

    return new Date(value).toISOString();
  }

  private static normalizeContactInfo(contactInfo?: ContactInfo): ContactInfo {
    if (!contactInfo) {
      return {};
    }

    const normalized: ContactInfo = {};
    if (contactInfo.email) {
      normalized.email = contactInfo.email.trim();
    }

    if (contactInfo.phone) {
      normalized.phone = contactInfo.phone.trim();
    }

    return normalized;
  }

  private static normalizePhone(value: string): string {
    return value.replace(/[^\d]/g, '');
  }

  private static isValidIsoDate(value: string): boolean {
    return Number.isFinite(Date.parse(value));
  }

  private static cloneContactInfo(contactInfo: ContactInfo): ContactInfo {
    return { ...contactInfo };
  }

  private static cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(metadata ?? {}));
  }

  private static readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly phonePattern = /^\d{7,15}$/;
}

export default Person;
