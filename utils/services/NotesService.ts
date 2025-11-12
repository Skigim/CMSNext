import { v4 as uuidv4 } from 'uuid';
import type { CaseDisplay, NewNoteData } from '../../types/case';
import type { CaseActivityEntry } from '../../types/activityLog';
import type { FileStorageService, FileData } from './FileStorageService';
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

function formatCaseDisplayName(caseData: CaseDisplay): string {
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
 * NotesService - Handles all note CRUD operations for cases
 * 
 * Responsibilities:
 * - Add notes to cases
 * - Update existing notes
 * - Delete notes
 * - Sanitize note content for PII
 * - Generate activity log entries for note operations
 */
export class NotesService {
  private fileStorage: FileStorageService;

  constructor(config: NotesServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  /**
   * Add note to a case
   * Pattern: read → modify → write
   */
  async addNote(caseId: string, noteData: NewNoteData): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Ensure caseRecord exists
    if (!targetCase.caseRecord) {
      throw new Error('Case record is missing - data integrity issue. Please reload the data.');
    }

    // Create new note
    const timestamp = new Date().toISOString();
    const newNote = {
      id: uuidv4(),
      category: noteData.category || 'General',
      content: noteData.content,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Modify case data
    const caseWithNewNote: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        notes: [...(targetCase.caseRecord.notes || []), newNote],
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithNewNote : c,
    );

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
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

    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
      activityLog: ActivityLogService.mergeActivityEntries(currentData.activityLog, [activityEntry]),
    };

    // Write back to file
    await this.fileStorage.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Update note in a case
   * Pattern: read → modify → write
   */
  async updateNote(caseId: string, noteId: string, noteData: NewNoteData): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Ensure caseRecord exists
    if (!targetCase.caseRecord) {
      throw new Error('Case record is missing - data integrity issue. Please reload the data.');
    }

    // Find note to update
    const noteIndex = (targetCase.caseRecord.notes || []).findIndex(note => note.id === noteId);
    if (noteIndex === -1) {
      throw new Error('Note not found');
    }

    const existingNote = targetCase.caseRecord.notes![noteIndex];

    // Update note
    const updatedNote = {
      ...existingNote,
      category: noteData.category || existingNote.category,
      content: noteData.content,
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const caseWithUpdatedNote: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        notes: (targetCase.caseRecord.notes || []).map((note, index) =>
          index === noteIndex ? updatedNote : note,
        ),
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithUpdatedNote : c,
    );

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.fileStorage.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Delete note from a case
   * Pattern: read → modify → write
   */
  async deleteNote(caseId: string, noteId: string): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Ensure caseRecord exists
    if (!targetCase.caseRecord) {
      throw new Error('Case record is missing - data integrity issue. Please reload the data.');
    }

    // Check if note exists
    const noteExists = (targetCase.caseRecord.notes || []).some(note => note.id === noteId);
    if (!noteExists) {
      throw new Error('Note not found');
    }

    // Modify case data
    const caseWithNoteRemoved: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        notes: (targetCase.caseRecord.notes || []).filter(note => note.id !== noteId),
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithNoteRemoved : c,
    );

    const casesWithTouchedTimestamps = this.fileStorage.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.fileStorage.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
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
