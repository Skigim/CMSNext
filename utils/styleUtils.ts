/**
 * Style utilities for consistent UI styling patterns.
 *
 * Extracted from component files to provide shared styling logic.
 *
 * @module utils/styleUtils
 */

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
