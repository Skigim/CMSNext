import type { NewNoteData } from "@/types/case";

export function resolveNoteCategories(noteData: NewNoteData, fallbackCategory: string): string[] {
  const rawCategories = noteData.categories ?? (noteData.category ? [noteData.category] : []);
  const categories = Array.from(
    new Set(rawCategories.map(category => category.trim()).filter(Boolean))
  );

  return categories.length > 0 ? categories : [fallbackCategory];
}
