/**
 * Style utilities for consistent UI styling patterns.
 *
 * Extracted from component files to provide shared styling logic.
 *
 * @module utils/styleUtils
 */

/**
 * Default color palette for note categories.
 *
 * Used when categories are dynamically assigned colors based on their index
 * in the category list. Provides consistent visual distinction between categories.
 */
export const NOTE_CATEGORY_COLORS = [
  "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "bg-green-500/10 text-green-600 border-green-500/20",
  "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "bg-red-500/10 text-red-600 border-red-500/20",
  "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "bg-pink-500/10 text-pink-600 border-pink-500/20",
  "bg-teal-500/10 text-teal-600 border-teal-500/20",
  "bg-slate-500/10 text-slate-600 border-slate-500/20",
] as const;

/**
 * Static color mapping for known note categories (NotesPopover style).
 *
 * Provides consistent colors for common category names with dark mode support.
 */
export const STATIC_NOTE_CATEGORY_COLORS: Record<string, string> = {
  General: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Important: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "Follow Up": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  Contact: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

/**
 * Get category color from static mapping.
 *
 * Used by NotesPopover for simple category-to-color mapping without
 * requiring a category list. Falls back to "General" color for unknown categories.
 *
 * @param category - Category name to look up
 * @returns Tailwind CSS class string for the category color
 *
 * @example
 * ```typescript
 * const color = getStaticNoteCategoryColor("Important");
 * // Returns "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
 * ```
 */
export function getStaticNoteCategoryColor(category: string): string {
  return STATIC_NOTE_CATEGORY_COLORS[category] ?? STATIC_NOTE_CATEGORY_COLORS.General;
}
