import { v4 as uuidv4 } from 'uuid';
import type { NewNoteData } from '../../types/case';
import type { CaseActivityEntry } from '../../types/activityLog';
import type { FileStorageService, NormalizedFileData, StoredNote, StoredCase } from './FileStorageService';
import { ActivityLogService } from './ActivityLogService';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const LONG_NUMBER_PATTERN = /\b\d{10,}\b/g;
const SSN_PATTERN = /\b\d{3}-?\d{2}-?\d{4}\b/g;

function sanitizeNoteContent(content: string): string {
  return content
    .replace(EMAIL_PATTERN, "***@***")
    .replace(SSN_PATTERN, "***-**-****")
    .replace(LONG_NUMBER_PATTERN, "***")
    .replace(/\s+/g, " ")
    .trim();
}

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

function formatCaseDisplayName(caseData: StoredCase): string {
  const trimmedName = (caseData.name ?? "").trim();
  if (trimmedName.length > 0) {
    return trimmedName;
  }

  const firstName = caseData.person?.firstName?.trim() ?? "";
  const lastName = caseData.person?.lastName?.trim() ?? "";
  const composed = `${firstName} ${lastName}`.trim();

  if (composed.length > 0) {
    return composed;
  }

  return "Unknown Case";
}

interface NotesServiceConfig {
  fileStorage: FileStorageService;
}

/**
 * NotesService - Handles all note CRUD operations
 * 
 * Works directly with normalized v2.0 data format:
 * - Notes stored as flat array with caseId foreign key
 * - No nested case structures
 * 
 * Responsibilities:
 * - Add notes to cases
 * - Update existing notes
 * - Delete notes
 * - Get notes for a case
 * - Sanitize note content for PII
 * - Generate activity log entries for note operations
 */
export class NotesService {
  private fileStorage: FileStorageService;

  constructor(config: NotesServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  /**
   * Get all notes for a case
   */
  async getNotesForCase(caseId: string): Promise<StoredNote[]> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      return [];
    }
    return this.fileStorage.getNotesForCase(data, caseId);
  }

  /**
   * Add note to a case
   * Pattern: read → modify → write
   */
  async addNote(caseId: string, noteData: NewNoteData): Promise<StoredNote> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case (needed for activity log)
    const targetCase = currentData.cases.find(c => c.id === caseId);
    if (!targetCase) {
      throw new Error('Case not found');
    }

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
   * Update note
   * Pattern: read → modify → write
   */
  async updateNote(caseId: string, noteId: string, noteData: NewNoteData): Promise<StoredNote> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Verify case exists first
    const caseExists = currentData.cases.some(c => c.id === caseId);
    if (!caseExists) {
      throw new Error('Case not found');
    }

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
   * Delete note
   * Pattern: read → modify → write
   */
  async deleteNote(caseId: string, noteId: string): Promise<void> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Verify case exists first
    const caseExists = currentData.cases.some(c => c.id === caseId);
    if (!caseExists) {
      throw new Error('Case not found');
    }

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
   * Get the case data for a note (for backward compatibility)
   */
  async getCaseForNote(caseId: string): Promise<StoredCase | null> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      return null;
    }
    return this.fileStorage.getCaseById(data, caseId) ?? null;
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
