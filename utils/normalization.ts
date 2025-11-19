import { v4 as uuidv4 } from 'uuid';
import type { CaseDisplay } from "../types/case";

/**
 * Normalizes note metadata for a collection of cases while gracefully pruning invalid entries.
 *
 * Ensures each note has an identifier, category, content, and timestamps. Notes that are not
 * objects are discarded instead of being converted into placeholder items to avoid confusing
 * empty entries in the UI.
 *
 * @param cases - The case collection to normalize.
 * @returns A tuple containing the normalized cases array and whether any changes were applied.
 */
export function normalizeCaseNotes(cases: CaseDisplay[]): { cases: CaseDisplay[]; changed: boolean } {
  let changed = false;

  const normalizedCases = cases.map(caseItem => {
    const notes = caseItem.caseRecord?.notes;
    if (!Array.isArray(notes) || notes.length === 0) {
      return caseItem;
    }

    let notesChanged = false;
    const filteredNotes = notes.filter(note => {
      const isValid = !!note && typeof note === "object";
      if (!isValid) {
        notesChanged = true;
        changed = true;
      }
      return isValid;
    });

    if (filteredNotes.length === 0) {
      return {
        ...caseItem,
        caseRecord: {
          ...caseItem.caseRecord,
          notes: [],
        },
      };
    }

    const normalizedNotes = filteredNotes.map(note => {
      let noteChanged = false;

      const hasValidId = typeof note.id === "string" && note.id.trim().length > 0;
      const normalizedId = hasValidId ? note.id : uuidv4();
      if (!hasValidId) {
        noteChanged = true;
      }

      const normalizedCategory = note.category || "General";
      const normalizedContent = typeof note.content === "string" ? note.content : "";
      const normalizedCreatedAt = note.createdAt || note.updatedAt || new Date().toISOString();
      const normalizedUpdatedAt = note.updatedAt || normalizedCreatedAt;

      if (
        noteChanged ||
        normalizedCategory !== note.category ||
        normalizedContent !== note.content ||
        normalizedCreatedAt !== note.createdAt ||
        normalizedUpdatedAt !== note.updatedAt
      ) {
        noteChanged = true;
      }

      if (!noteChanged) {
        return note;
      }

      notesChanged = true;
      changed = true;
      return {
        ...note,
        id: normalizedId,
        category: normalizedCategory,
        content: normalizedContent,
        createdAt: normalizedCreatedAt,
        updatedAt: normalizedUpdatedAt,
      };
    });

    if (!notesChanged) {
      return caseItem;
    }

    return {
      ...caseItem,
      caseRecord: {
        ...caseItem.caseRecord,
        notes: normalizedNotes,
      },
    };
  });

  return { cases: normalizedCases, changed };
}
