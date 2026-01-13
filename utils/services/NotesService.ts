import { v4 as uuidv4 } from 'uuid';
import type { NewNoteData } from '../../types/case';
import type { CaseActivityEntry } from '../../types/activityLog';
import type { FileStorageService, NormalizedFileData, StoredNote } from './FileStorageService';
import { ActivityLogService } from './ActivityLogService';
import { formatCaseDisplayName } from '../../domain/cases/formatting';
import { readDataAndFindCase, readDataAndRequireCase } from '../serviceHelpers';

/** Regular expression to detect email addresses in note content */
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
/** Regular expression to detect long numbers (10+ digits) in note content */
const LONG_NUMBER_PATTERN = /\b\d{10,}\b/g;
/** Regular expression to detect SSN patterns in note content */
const SSN_PATTERN = /\b\d{3}-?\d{2}-?\d{4}\b/g;

/**
 * Sanitize note content by redacting personally identifiable information (PII).
 * 
 * Replaces:
 * - Email addresses with "***@***"
 * - SSN patterns with "***-**-****"
 * - Long numbers (10+ digits) with "***"
 * 
 * Also normalizes whitespace.
 * 
 * @private
 * @param {string} content - The note content to sanitize
 * @returns {string} Sanitized content with PII redacted
 */
function sanitizeNoteContent(content: string): string {
  return content
    .replace(EMAIL_PATTERN, "***@***")
    .replace(SSN_PATTERN, "***-**-****")
    .replace(LONG_NUMBER_PATTERN, "***")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a preview string from note content.
 * 
 * Creates a sanitized preview limited to 160 characters.
 * Adds ellipsis (…) if content is truncated.
 * 
 * @private
 * @param {string} content - The note content to preview
 * @returns {string} Preview string (max 160 characters, sanitized)
 */
function buildNotePreview(content: string): string {
  const sanitized = sanitizeNoteContent(content);

  if (sanitized.length === 0) {
    return "";
  }

  if (sanitized.length <= 160) {
    return sanitized;
  }
  return `${sanitized.slice(0, 157)}…`;
}


/**
 * Configuration for NotesService initialization.
 * @interface NotesServiceConfig
 */
interface NotesServiceConfig {
  /** File storage service for reading/writing note data */
  fileStorage: FileStorageService;
}

/**
 * NotesService - Note operations with PII protection
 * 
 * This service handles all operations related to case notes in the normalized
 * v2.0 format. Notes are stored separately from cases with foreign key references.
 * 
 * ## Architecture
 * 
 * ```
 * NotesService
 *     ↓
 * FileStorageService (read/write operations)
 *     ↓
 * AutosaveFileService (file I/O)
 * ```
 * 
 * ## Data Format
 * 
 * Notes are stored in a flat array with foreign keys:
 * 
 * ```typescript
 * {
 *   id: string,
 *   caseId: string,  // Foreign key to case
 *   content: string,
 *   preview: string,  // Auto-generated sanitized preview
 *   author: string,
 *   createdAt: string,
 *   updatedAt: string
 * }
 * ```
 * 
 * ## Core Responsibilities
 * 
 * ### CRUD Operations
 * - Add notes to cases
 * - Update existing notes
 * - Delete notes
 * - Get notes for a case
 * 
 * ### PII Protection
 * - Sanitize note content to redact emails, SSNs, and long numbers
 * - Generate sanitized previews for note listings
 * - Protect sensitive information in activity logs
 * 
 * ### Activity Logging
 * - Create activity log entries for note additions
 * - Track note operations with sanitized content
 * 
 * ### Data Integrity
 * - Verify case exists before adding notes
 * - Update case timestamps when notes change
 * - Maintain note timestamps (createdAt, updatedAt)
 * 
 * ## Pattern: Read → Modify → Write
 * 
 * All operations follow the stateless pattern:
 * 1. Read current data from file
 * 2. Modify data in memory
 * 3. Generate sanitized previews
 * 4. Update related timestamps
 * 5. Write updated data back to file
 * 6. Return updated entity
 * 
 * No data is cached - file system is single source of truth.
 * 
 * @class NotesService
 * @see {@link FileStorageService} for underlying storage operations
 * @see {@link ActivityLogService} for activity logging
 */
export class NotesService {
  /** File storage service for data persistence */
  private fileStorage: FileStorageService;

  /**
   * Create a new NotesService instance.
   * 
   * @param {NotesServiceConfig} config - Configuration object
   * @param {FileStorageService} config.fileStorage - File storage service instance
   */
  constructor(config: NotesServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  /**
   * Get all notes for a specific case.
   * 
   * Returns notes with caseId foreign key in normalized format.
   * Always reads fresh data from disk.
   * 
   * @param {string} caseId - The case ID to get notes for
   * @returns {Promise<StoredNote[]>} Array of notes for the case
   * 
   * @example
   * const notes = await notesService.getNotesForCase(caseId);
   * console.log(`Case has ${notes.length} notes`);
   */
  async getNotesForCase(caseId: string): Promise<StoredNote[]> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      return [];
    }
    return this.fileStorage.getNotesForCase(data, caseId);
  }

  /**
   * Add a note to a case.
   * 
   * This method:
   * 1. Reads current data from file
   * 2. Verifies case exists
   * 3. Creates new note with foreign key (caseId)
   * 4. Generates sanitized preview for activity log
   * 5. Creates activity log entry with PII protection
   * 6. Updates case timestamp
   * 7. Writes back to file
   * 8. Returns the created note
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * **PII Protection:** Note content is sanitized before being added to the
   * activity log, redacting emails, SSNs, and long numbers.
   * 
   * @param {string} caseId - The case ID to add the note to
   * @param {NewNoteData} noteData - The note data (content, author, category)
   * @returns {Promise<StoredNote>} The created note with caseId foreign key
   * @throws {Error} If failed to read current data or case not found
   * 
   * @example
   * const note = await notesService.addNote(caseId, {
   *   content: "Called client to schedule follow-up",
   *   category: "Contact",
   *   author: "John Smith"
   * });
   * // Activity log entry created with sanitized content
   */
  async addNote(caseId: string, noteData: NewNoteData): Promise<StoredNote> {
    // Read and verify case exists
    const { data: noteData_, targetCase } = await readDataAndFindCase(this.fileStorage, caseId);
    const currentData = noteData_;

    // Create new note with foreign key
    const timestamp = new Date().toISOString();
    const newNote: StoredNote = {
      id: uuidv4(),
      caseId,
      category: noteData.category || 'General',
      content: noteData.content,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Add to notes array
    const updatedNotes = [...currentData.notes, newNote];

    // Touch case timestamp
    const updatedCases = this.fileStorage.touchCaseTimestamps(currentData.cases, [caseId]);

    // Create activity log entry
    const sanitizedContent = sanitizeNoteContent(noteData.content ?? "");
    const activityEntry: CaseActivityEntry = {
      id: uuidv4(),
      timestamp,
      caseId: targetCase.id,
      caseName: formatCaseDisplayName(targetCase),
      caseMcn: targetCase.caseRecord?.mcn ?? targetCase.mcn ?? null,
      type: "note-added",
      payload: {
        noteId: newNote.id,
        category: newNote.category,
        preview: buildNotePreview(noteData.content ?? ""),
        content: sanitizedContent,
      },
    };

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: updatedCases,
      notes: updatedNotes,
      activityLog: ActivityLogService.mergeActivityEntries(currentData.activityLog, [activityEntry]),
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    return newNote;
  }

  /**
   * Update a note in a case.
   * 
   * This method:
   * 1. Reads current data from file
   * 2. Verifies case and note exist
   * 3. Updates note with provided fields
   * 4. Preserves ID, foreign key, and creation timestamp
   * 5. Updates case timestamp
   * 6. Writes back to file
   * 7. Returns the updated note
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * @param {string} caseId - The case ID
   * @param {string} noteId - The ID of the note to update
   * @param {NewNoteData} noteData - The updated note data
   * @returns {Promise<StoredNote>} The updated note
   * @throws {Error} If failed to read current data, case not found, or note not found
   * 
   * @example
   * const updated = await notesService.updateNote(caseId, noteId, {
   *   content: "Updated: Client rescheduled for next week",
   *   category: "Contact"
   * });
   */
  async updateNote(caseId: string, noteId: string, noteData: NewNoteData): Promise<StoredNote> {
    // Read and verify case exists
    const currentData = await readDataAndRequireCase(this.fileStorage, caseId);

    // Find note to update
    const noteIndex = currentData.notes.findIndex(
      n => n.id === noteId && n.caseId === caseId
    );
    if (noteIndex === -1) {
      throw new Error('Note not found');
    }

    const existingNote = currentData.notes[noteIndex];

    // Update note
    const updatedNote: StoredNote = {
      ...existingNote,
      category: noteData.category || existingNote.category,
      content: noteData.content,
      updatedAt: new Date().toISOString()
    };

    // Update notes array
    const updatedNotes = currentData.notes.map((n, index) =>
      index === noteIndex ? updatedNote : n
    );

    // Touch case timestamp
    const updatedCases = this.fileStorage.touchCaseTimestamps(currentData.cases, [caseId]);

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: updatedCases,
      notes: updatedNotes,
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    return updatedNote;
  }

  /**
   * Delete a note from a case.
   * 
   * This method:
   * 1. Reads current data from file
   * 2. Verifies case and note exist
   * 3. Removes note from notes array
   * 4. Updates case timestamp
   * 5. Writes back to file
   * 
   * **Pattern:** Read → Modify → Write
   * 
   * **Warning:** This operation is permanent and cannot be undone.
   * 
   * @param {string} caseId - The case ID
   * @param {string} noteId - The ID of the note to delete
   * @returns {Promise<void>}
   * @throws {Error} If failed to read current data, case not found, or note not found
   * 
   * @example
   * await notesService.deleteNote(caseId, noteId);
   * console.log('Note deleted');
   */
  async deleteNote(caseId: string, noteId: string): Promise<void> {
    // Read and verify case exists
    const currentData = await readDataAndRequireCase(this.fileStorage, caseId);

    // Verify note exists
    const noteExists = currentData.notes.some(
      n => n.id === noteId && n.caseId === caseId
    );
    if (!noteExists) {
      throw new Error('Note not found');
    }

    // Remove from notes array
    const updatedNotes = currentData.notes.filter(
      n => !(n.id === noteId && n.caseId === caseId)
    );

    // Touch case timestamp
    const updatedCases = this.fileStorage.touchCaseTimestamps(currentData.cases, [caseId]);

    // Write updated data
    const updatedData: NormalizedFileData = {
      ...currentData,
      cases: updatedCases,
      notes: updatedNotes,
    };

    await this.fileStorage.writeNormalizedData(updatedData);
  }

  /**
   * Static utility: Sanitize note content to remove PII
   */
  static sanitizeNoteContent(content: string): string {
    return sanitizeNoteContent(content);
  }

  /**
   * Static utility: Build note preview (max 160 chars, sanitized)
   */
  static buildNotePreview(content: string): string {
    return buildNotePreview(content);
  }
}
