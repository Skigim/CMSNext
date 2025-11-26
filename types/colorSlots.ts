/**
 * Color Slot System
 * 
 * Provides a semantic color palette that adapts to themes.
 * Users pick a "slot" (e.g., 'blue'), and each theme defines
 * what that slot looks like via CSS custom properties.
 * 
 * This ensures consistent color semantics across:
 * - Status badges
 * - Pie charts
 * - Any future colored elements
 */

/**
 * Available color slots that users can assign to statuses/categories.
 * Each slot maps to theme-aware CSS variables.
 */
export const COLOR_SLOTS = [
  'blue',
  'green', 
  'red',
  'amber',
  'purple',
  'slate',
  'teal',
  'rose',
  'orange',
  'cyan',
] as const;

export type ColorSlot = typeof COLOR_SLOTS[number];

/**
 * Default color assignments for built-in case statuses.
 * These provide sensible defaults that users can override.
 */
export const DEFAULT_STATUS_COLORS: Record<string, ColorSlot> = {
  'Pending': 'blue',
  'Approved': 'green',
  'Denied': 'red',
  'Spenddown': 'amber',
  'Closed': 'slate',
};

/**
 * Get the CSS variable name for a color slot's main color.
 */
export function getColorSlotVar(slot: ColorSlot): string {
  return `var(--color-slot-${slot})`;
}

/**
 * Get the CSS variable name for a color slot's background (10% opacity).
 */
export function getColorSlotBgVar(slot: ColorSlot): string {
  return `var(--color-slot-${slot}-bg)`;
}

/**
 * Get the CSS variable name for a color slot's border (20% opacity).
 */
export function getColorSlotBorderVar(slot: ColorSlot): string {
  return `var(--color-slot-${slot}-border)`;
}

/**
 * Get Tailwind-compatible class string for a badge using a color slot.
 * Returns classes that reference the CSS custom properties.
 */
export function getColorSlotBadgeClasses(slot: ColorSlot): string {
  return `bg-[var(--color-slot-${slot}-bg)] text-[var(--color-slot-${slot})] border-[var(--color-slot-${slot}-border)]`;
}

/**
 * Auto-assign a color slot to a status that doesn't have one.
 * Tries to use unused slots first, then cycles through all slots.
 */
export function autoAssignColorSlot(
  statusName: string,
  usedSlots: Set<ColorSlot>
): ColorSlot {
  // First, check if there's a default for this status name
  const defaultSlot = DEFAULT_STATUS_COLORS[statusName];
  if (defaultSlot && !usedSlots.has(defaultSlot)) {
    return defaultSlot;
  }

  // Find first unused slot
  for (const slot of COLOR_SLOTS) {
    if (!usedSlots.has(slot)) {
      return slot;
    }
  }

  // All slots used, cycle based on status name hash
  const hash = statusName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLOR_SLOTS[hash % COLOR_SLOTS.length];
}

/**
 * Validate that a value is a valid ColorSlot
 */
export function isValidColorSlot(value: unknown): value is ColorSlot {
  return typeof value === 'string' && COLOR_SLOTS.includes(value as ColorSlot);
}
