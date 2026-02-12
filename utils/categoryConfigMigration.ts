/**
 * MIGRATION: Legacy string[] to StatusConfig[]
 * 
 * This file handles backward compatibility for caseStatuses migration.
 * DELETE THIS FILE after all users have migrated their save files.
 * 
 * Migration date: November 2025
 * Safe to remove: After December 2025 release
 */

import { 
  type ColorSlot, 
  DEFAULT_STATUS_COLORS,
  DEFAULT_ALERT_COLORS,
  autoAssignColorSlot,
  isValidColorSlot,
  COLOR_SLOTS,
} from '@/types/colorSlots';
import type { StatusConfig, AlertTypeConfig } from '@/types/categoryConfig';

/**
 * Legacy statuses that should default to countsAsCompleted=true when discovered.
 * Matches the LEGACY_COMPLETION_STATUSES in types/categoryConfig.ts.
 */
const LEGACY_COMPLETION_STATUSES = new Set(['approved', 'denied', 'closed', 'spenddown']);

/**
 * Type guard to check if a value is a legacy string array format
 */
export function isLegacyStatusArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  return typeof value[0] === 'string';
}

/**
 * Type guard to check if a value is the new StatusConfig array format
 */
export function isStatusConfigArray(value: unknown): value is StatusConfig[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true; // Empty array is valid
  const first = value[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    'name' in first &&
    'colorSlot' in first
  );
}

/**
 * Migrate legacy string[] caseStatuses to StatusConfig[]
 * Assigns colors based on DEFAULT_STATUS_COLORS or auto-assigns unused slots.
 */
export function migrateLegacyStatuses(legacyStatuses: string[]): StatusConfig[] {
  const usedSlots = new Set<ColorSlot>();
  
  return legacyStatuses.map((name) => {
    const trimmedName = name.trim();
    
    // Check for default color first
    const defaultColor = DEFAULT_STATUS_COLORS[trimmedName];
    if (defaultColor && !usedSlots.has(defaultColor)) {
      usedSlots.add(defaultColor);
      return { name: trimmedName, colorSlot: defaultColor };
    }
    
    // Auto-assign from unused slots
    const colorSlot = autoAssignColorSlot(trimmedName, usedSlots);
    usedSlots.add(colorSlot);
    return { name: trimmedName, colorSlot };
  });
}

/**
 * Normalize caseStatuses from either legacy or new format to StatusConfig[]
 */
export function normalizeCaseStatuses(
  value: string[] | StatusConfig[] | undefined | null
): StatusConfig[] {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return [];
  }
  
  // Already in new format
  if (isStatusConfigArray(value)) {
    // Validate and sanitize
    return value
      .filter((item): item is StatusConfig => 
        typeof item === 'object' && 
        item !== null && 
        typeof item.name === 'string' &&
        item.name.trim().length > 0
      )
      .map(item => ({
        name: item.name.trim(),
        colorSlot: isValidColorSlot(item.colorSlot) ? item.colorSlot : 'slate',
      }));
  }
  
  // Legacy format - migrate
  if (isLegacyStatusArray(value)) {
    console.info('[CategoryConfig] Migrating legacy caseStatuses format to StatusConfig[]');
    return migrateLegacyStatuses(value);
  }
  
  return [];
}

/**
 * Extract the status string from a case item, handling both flat and nested formats.
 */
function extractStatusFromCase(
  caseItem: { status?: string } | { caseRecord?: { status?: string } }
): string | undefined {
  if ('caseRecord' in caseItem && caseItem.caseRecord) {
    return caseItem.caseRecord.status;
  }
  if ('status' in caseItem) {
    return caseItem.status;
  }
  return undefined;
}

/**
 * Assign a color slot, preferring the default color if available and unused.
 */
function assignColorSlotForStatus(name: string, usedSlots: Set<ColorSlot>): ColorSlot {
  const defaultColor = DEFAULT_STATUS_COLORS[name];
  if (defaultColor && !usedSlots.has(defaultColor)) {
    return defaultColor;
  }
  return autoAssignColorSlot(name, usedSlots);
}

/**
 * Discover statuses used in case data that aren't in the config.
 * Auto-assigns colors to newly discovered statuses.
 * 
 * @param existingStatuses - Current StatusConfig array
 * @param cases - Array of cases with status field
 * @returns Updated StatusConfig array with any discovered statuses added
 */
export function discoverStatusesFromCases(
  existingStatuses: StatusConfig[],
  cases: Array<{ status?: string } | { caseRecord?: { status?: string } }>
): StatusConfig[] {
  const existingNames = new Set(
    existingStatuses.map(s => s.name.toLowerCase())
  );
  const usedSlots = new Set<ColorSlot>(
    existingStatuses.map(s => s.colorSlot)
  );
  
  const discoveredStatuses: StatusConfig[] = [];
  const discoveredNames = new Set<string>();
  
  for (const caseItem of cases) {
    const status = extractStatusFromCase(caseItem);
    if (!status || typeof status !== 'string') continue;
    
    const trimmed = status.trim();
    if (!trimmed) continue;
    
    const lowerName = trimmed.toLowerCase();
    if (existingNames.has(lowerName) || discoveredNames.has(lowerName)) continue;
    
    discoveredNames.add(lowerName);
    const colorSlot = assignColorSlotForStatus(trimmed, usedSlots);
    usedSlots.add(colorSlot);
    
    discoveredStatuses.push({ 
      name: trimmed, 
      colorSlot,
      countsAsCompleted: LEGACY_COMPLETION_STATUSES.has(lowerName),
    });
  }
  
  if (discoveredStatuses.length > 0) {
    console.info(
      `[CategoryConfig] Discovered ${discoveredStatuses.length} status(es) from case data:`,
      discoveredStatuses.map(s => s.name)
    );
  }
  
  return [...existingStatuses, ...discoveredStatuses];
}

/**
 * Discover alert types used in alert data that aren't in the config.
 * Auto-assigns colors to newly discovered alert types.
 * 
 * @param existingAlertTypes - Current AlertTypeConfig array
 * @param alerts - Array of alerts with description field
 * @returns Updated AlertTypeConfig array with any discovered alert types added
 */
export function discoverAlertTypesFromAlerts(
  existingAlertTypes: AlertTypeConfig[],
  alerts: Array<{ description?: string }>
): AlertTypeConfig[] {
  // Build set of existing alert type names (case-insensitive)
  const existingNames = new Set(
    existingAlertTypes.map(a => a.name.toLowerCase())
  );
  
  // Track used color slots to avoid duplicates when assigning
  const usedSlots = new Set<ColorSlot>(
    existingAlertTypes.map(a => a.colorSlot)
  );
  
  // Collect unique alert types from alerts
  const discoveredAlertTypes: AlertTypeConfig[] = [];
  const discoveredNames = new Set<string>();
  
  for (const alert of alerts) {
    const description = alert.description;
    
    if (!description || typeof description !== 'string') continue;
    
    const trimmed = description.trim();
    if (!trimmed) continue;
    
    const lowerName = trimmed.toLowerCase();
    
    // Skip if already exists in config or already discovered
    if (existingNames.has(lowerName) || discoveredNames.has(lowerName)) {
      continue;
    }
    
    // Discover this alert type
    discoveredNames.add(lowerName);
    
    // Assign a color - check default colors first
    const defaultColor = DEFAULT_ALERT_COLORS[trimmed];
    let colorSlot: ColorSlot;
    
    if (defaultColor && !usedSlots.has(defaultColor)) {
      colorSlot = defaultColor;
    } else {
      // Auto-assign from unused slots
      colorSlot = autoAssignAlertColorSlot(trimmed, usedSlots);
    }
    
    usedSlots.add(colorSlot);
    discoveredAlertTypes.push({ name: trimmed, colorSlot });
  }
  
  if (discoveredAlertTypes.length > 0) {
    console.info(
      `[CategoryConfig] Discovered ${discoveredAlertTypes.length} alert type(s) from alert data:`,
      discoveredAlertTypes.map(a => a.name)
    );
  }
  
  // Return combined array - existing first, then discovered
  return [...existingAlertTypes, ...discoveredAlertTypes];
}

/**
 * Auto-assign a color slot to an alert type that doesn't have one.
 * Tries to use unused slots first, then cycles through all slots.
 */
function autoAssignAlertColorSlot(
  alertTypeName: string,
  usedSlots: Set<ColorSlot>
): ColorSlot {
  // First, check if there's a default for this alert type name
  const defaultSlot = DEFAULT_ALERT_COLORS[alertTypeName];
  if (defaultSlot && !usedSlots.has(defaultSlot)) {
    return defaultSlot;
  }

  // Find first unused slot
  for (const slot of COLOR_SLOTS) {
    if (!usedSlots.has(slot)) {
      return slot;
    }
  }

  // All slots used, cycle based on alert type name hash
  const hash = alertTypeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLOR_SLOTS[hash % COLOR_SLOTS.length];
}

/**
 * Find a StatusConfig by name (case-insensitive)
 */
export function findStatusConfig(
  statuses: StatusConfig[],
  name: string
): StatusConfig | undefined {
  const normalizedName = name.trim().toLowerCase();
  return statuses.find(s => s.name.toLowerCase() === normalizedName);
}

/**
 * Get the color slot for a status name, with fallback
 */
export function getStatusColorSlot(
  statuses: StatusConfig[],
  name: string,
  fallback: ColorSlot = 'slate'
): ColorSlot {
  const config = findStatusConfig(statuses, name);
  return config?.colorSlot ?? fallback;
}
