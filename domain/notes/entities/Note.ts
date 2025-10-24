export type NoteCategory = string;

export interface Note {
  id: string;
  caseId: string;
  category: NoteCategory;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorId?: string;
  metadata?: Record<string, unknown>;
}
