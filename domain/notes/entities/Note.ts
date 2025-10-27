import { ValidationError } from '@/domain/common/errors/ValidationError';

export type NoteCategory = string;

export interface NoteSnapshot {
  id: string;
  caseId: string;
  category: NoteCategory;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorId?: string;
  metadata: Record<string, unknown>;
}

export interface NoteCreateInput {
  id?: string;
  caseId: string;
  category: NoteCategory;
  content: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  authorId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Domain entity representing a note associated with a case.
 * Encapsulates validation and business rules for note management.
 */
export class Note {
  private props: NoteSnapshot;

  private constructor(props: NoteSnapshot) {
    this.props = { ...props, metadata: Note.cloneMetadata(props.metadata) };
    this.validate();
  }

  /**
   * Factory for creating a new note with generated identifiers and timestamps.
   */
  static create(input: NoteCreateInput): Note {
    const now = new Date();
    return new Note({
      id: input.id?.trim() || Note.generateId(),
      caseId: input.caseId.trim(),
      category: input.category.trim(),
      content: input.content.trim(),
      createdAt: Note.normalizeDate(input.createdAt ?? now),
      updatedAt: Note.normalizeDate(input.updatedAt ?? now),
      authorId: input.authorId?.trim(),
      metadata: Note.cloneMetadata(input.metadata ?? {}),
    });
  }

  /**
   * Reconstruct an existing note from persisted storage.
   */
  static rehydrate(snapshot: NoteSnapshot): Note {
    return new Note({
      id: snapshot.id,
      caseId: snapshot.caseId,
      category: snapshot.category,
      content: snapshot.content,
      createdAt: Note.normalizeDate(snapshot.createdAt),
      updatedAt: Note.normalizeDate(snapshot.updatedAt),
      authorId: snapshot.authorId,
      metadata: Note.cloneMetadata(snapshot.metadata ?? {}),
    });
  }

  /**
   * Clone the entity to maintain immutability guarantees.
   */
  clone(): Note {
    return Note.rehydrate(this.toJSON());
  }

  /**
   * Serialize to a plain snapshot suitable for persistence.
   */
  toJSON(): NoteSnapshot {
    return {
      id: this.id,
      caseId: this.caseId,
      category: this.category,
      content: this.content,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      authorId: this.authorId,
      metadata: Note.cloneMetadata(this.metadata),
    };
  }

  private validate(): void {
    if (!this.props.id?.trim()) {
      throw new ValidationError('Note ID is required');
    }
    if (!this.props.caseId?.trim()) {
      throw new ValidationError('Case ID is required');
    }
    if (!this.props.category?.trim()) {
      throw new ValidationError('Category is required');
    }
    if (!this.props.content?.trim()) {
      throw new ValidationError('Content is required');
    }
    if (!Note.isValidIsoDate(this.props.createdAt)) {
      throw new ValidationError('Note createdAt must be a valid ISO-8601 timestamp');
    }
    if (!Note.isValidIsoDate(this.props.updatedAt)) {
      throw new ValidationError('Note updatedAt must be a valid ISO-8601 timestamp');
    }
    if (typeof this.props.metadata !== 'object' || this.props.metadata === null) {
      throw new ValidationError('Note metadata must be an object');
    }
  }

  // Getters for all properties
  get id(): string {
    return this.props.id;
  }

  get caseId(): string {
    return this.props.caseId;
  }

  get category(): NoteCategory {
    return this.props.category;
  }

  get content(): string {
    return this.props.content;
  }

  get createdAt(): string {
    return this.props.createdAt;
  }

  get updatedAt(): string {
    return this.props.updatedAt;
  }

  get authorId(): string | undefined {
    return this.props.authorId;
  }

  get metadata(): Record<string, unknown> {
    return Note.cloneMetadata(this.props.metadata);
  }

  private static normalizeDate(value: string | Date): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (!Note.isValidIsoDate(value)) {
      throw new ValidationError('Invalid ISO date provided for note timestamp');
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
    return `note-${timestamp}-${randomSegment}`;
  }
}

export default Note;
