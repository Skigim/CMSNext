import type { Note, NoteCategory } from '@/domain/notes/entities/Note';
import type { IRepository } from './IRepository';

export interface INoteRepository extends IRepository<Note, string> {
  getByCaseId(caseId: string): Promise<Note[]>;
  filterByCategory(caseId: string, category: NoteCategory): Promise<Note[]>;
}
