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
 * Default color assignments for common alert types.
 * These provide sensible defaults that users can override.
 */
export const DEFAULT_ALERT_COLORS: Record<string, ColorSlot> = {
  'Overdue Documentation': 'red',
  'Case Closure Notice': 'amber',
  'Recertification Due': 'orange',
  'Income Verification': 'blue',
  'Residency Confirmation': 'teal',
  'Asset Threshold': 'purple',
  'Medical Review': 'rose',
  'Eligibility Review': 'cyan',
};

/**
 * Get the CSS variable name for a color slot's main color.
 */
export function getColorSlotVar(slot: ColorSlot): string {
  return `var(--color-slot-${slot})`;
}

/**
 * Style object for a badge using a color slot.
 * Uses inline styles to ensure CSS variables work with dynamic slot names.
 */
export interface ColorSlotBadgeStyle {
  backgroundColor: string;
  color: string;
  borderColor: string;
}

/**
 * Get inline style object for a badge using a color slot.
 * Returns a style object with CSS variable references.
 */
export function getColorSlotBadgeStyle(slot: ColorSlot): ColorSlotBadgeStyle {
  return {
    backgroundColor: `var(--color-slot-${slot}-bg)`,
    color: `var(--color-slot-${slot})`,
    borderColor: `var(--color-slot-${slot}-border)`,
  };
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
