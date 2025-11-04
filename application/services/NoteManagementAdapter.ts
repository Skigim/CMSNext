import type { INoteRepository } from '@/domain/common/repositories/INoteRepository';
import type { Note, NoteCategory } from '@/domain/notes/entities/Note';
import type { StorageRepository } from '@/infrastructure/storage/StorageRepository';

/**
 * Adapter Layer: Bridges NoteManagementService to StorageRepository
 * 
 * Purpose: Adapt the root-level notes collection API to the INoteRepository interface
 * Pattern: Adapter pattern - translates between domain and infrastructure layers
 */
export class NoteManagementAdapter implements INoteRepository {
  constructor(private readonly storage: StorageRepository) {}

  // IRepository base methods
  async getAll(): Promise<Note[]> {
    return this.storage.notes.getAll();
  }

  async getById(id: string): Promise<Note | null> {
    return this.storage.notes.getById(id);
  }

  async save(note: Note): Promise<void> {
    await this.storage.notes.save(note);
  }

  async delete(id: string): Promise<void> {
    await this.storage.notes.delete(id);
  }

  // INoteRepository extension methods
  async getByCaseId(caseId: string): Promise<Note[]> {
    return this.storage.notes.getByCaseId(caseId);
  }

  async filterByCategory(caseId: string, category: NoteCategory): Promise<Note[]> {
    const notes = await this.getByCaseId(caseId);
    return notes.filter(note => note.category === category);
  }
}
