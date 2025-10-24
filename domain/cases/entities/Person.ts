import { ValidationError } from '@/domain/common/errors/ValidationError';

export interface ContactInfo {
  email?: string;
  phone?: string;
}

export interface PersonSnapshot {
  name: string;
  dateOfBirth: string;
  contactInfo: ContactInfo;
}

export interface PersonProps extends PersonSnapshot {}

/**
 * Immutable value object representing person details associated with a case.
 */
export class Person {
  private readonly snapshot: PersonSnapshot;

  constructor(props: PersonProps) {
    this.snapshot = {
      name: Person.normalizeName(props.name),
      dateOfBirth: Person.normalizeDate(props.dateOfBirth),
      contactInfo: Person.freezeContactInfo(props.contactInfo ?? {}),
    };

    this.validate();
  }

  /**
   * Recreate a person value object from persisted data.
   */
  static rehydrate(snapshot: PersonSnapshot): Person {
    return new Person(snapshot);
  }

  /**
   * Serialize the value object to a plain snapshot.
   */
  toJSON(): PersonSnapshot {
    return {
      name: this.snapshot.name,
      dateOfBirth: this.snapshot.dateOfBirth,
      contactInfo: Person.cloneContactInfo(this.snapshot.contactInfo),
    };
  }

  /**
   * Person's full display name.
   */
  get name(): string {
    return this.snapshot.name;
  }

  /**
   * Date of birth stored as ISO 8601 string.
   */
  get dateOfBirth(): string {
    return this.snapshot.dateOfBirth;
  }

  /**
   * Contact information (email, phone, etc.).
   */
  get contactInfo(): ContactInfo {
    return Person.cloneContactInfo(this.snapshot.contactInfo);
  }

  private validate(): void {
    if (!this.snapshot.name.trim()) {
      throw new ValidationError('Person name cannot be empty');
    }

    if (!Person.isValidIsoDate(this.snapshot.dateOfBirth)) {
      throw new ValidationError('Person date of birth must be a valid ISO-8601 date string');
    }

    const { email, phone } = this.snapshot.contactInfo;
    if (email && !Person.emailPattern.test(email)) {
      throw new ValidationError('Person email address is invalid');
    }

    if (phone && !Person.phonePattern.test(Person.normalizedPhone(phone))) {
      throw new ValidationError('Person phone number is invalid');
    }
  }

  private static normalizeName(name: string): string {
    return name.trim();
  }

  private static normalizeDate(value: string): string {
    if (Person.isValidIsoDate(value)) {
      return new Date(value).toISOString();
    }

    return value;
  }

  private static isValidIsoDate(value: string): boolean {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp);
  }

  private static normalizedPhone(value: string): string {
    return value.replace(/[^\d]/g, '');
  }

  private static freezeContactInfo(contactInfo: ContactInfo): ContactInfo {
    return Object.freeze({ ...contactInfo });
  }

  private static cloneContactInfo(contactInfo: ContactInfo): ContactInfo {
    return { ...contactInfo };
  }

  private static readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly phonePattern = /^\d{7,15}$/;
}

export default Person;
