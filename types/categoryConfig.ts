import type { ColorSlot } from './colorSlots';
import { 
  DEFAULT_STATUS_COLORS,
  DEFAULT_ALERT_COLORS,
  autoAssignColorSlot, 
  isValidColorSlot 
} from './colorSlots';

export type CategoryKey =
  | "caseTypes"
  | "caseStatuses"
  | "alertTypes"
  | "livingArrangements"
  | "noteCategories"
  | "verificationStatuses";

/**
 * Configuration for a case status with its display color.
 */
export interface StatusConfig {
  name: string;
  colorSlot: ColorSlot;
  /** When true, transitioning to this status counts toward "cases processed" metrics */
  countsAsCompleted?: boolean;
}

/**
 * Configuration for an alert type with its display color.
 */
export interface AlertTypeConfig {
  name: string;
  colorSlot: ColorSlot;
}

export interface CategoryConfig {
  caseTypes: string[];
  caseStatuses: StatusConfig[];
  alertTypes: AlertTypeConfig[];
  livingArrangements: string[];
  noteCategories: string[];
  verificationStatuses: string[];
}

/**
 * Input format for partial config - supports both legacy string[] 
 * and new StatusConfig[] format for caseStatuses.
 * 
 * NOTE: Legacy string[] support is handled by utils/categoryConfigMigration.ts
 * and will be removed after migration period.
 */
export interface PartialCategoryConfigInput {
  caseTypes?: string[];
  caseStatuses?: string[] | StatusConfig[];
  alertTypes?: string[] | AlertTypeConfig[];
  livingArrangements?: string[];
  noteCategories?: string[];
  verificationStatuses?: string[];
}

const DEFAULT_CASE_TYPES = [
  "LTC",
  "Medicaid",
  "SNAP",
  "TANF",
  "Emergency",
  "Other",
];

// No default statuses - users must configure their own workflow
const DEFAULT_CASE_STATUSES: StatusConfig[] = [];

const DEFAULT_LIVING_ARRANGEMENTS = [
  "Apartment/House",
  "Assisted Living",
  "Nursing Home",
  "Group Home",
  "Family Home",
  "Independent Living",
  "Other",
];

const DEFAULT_NOTE_CATEGORIES = [
  "General",
  "VR Update",
  "Client Contact",
  "Case Review",
  "Document Request",
  "Follow-up Required",
  "Important",
  "Medical Update",
  "Financial Update",
  "Other",
];

const DEFAULT_VERIFICATION_STATUSES = [
  "Needs VR",
  "VR Pending",
  "AVS Pending",
  "Verified",
];

// No default alert types - populated from incoming alert data
const DEFAULT_ALERT_TYPES: AlertTypeConfig[] = [];

export const defaultCategoryConfig: CategoryConfig = Object.freeze({
  caseTypes: DEFAULT_CASE_TYPES,
  caseStatuses: DEFAULT_CASE_STATUSES,
  alertTypes: DEFAULT_ALERT_TYPES,
  livingArrangements: DEFAULT_LIVING_ARRANGEMENTS,
  noteCategories: DEFAULT_NOTE_CATEGORIES,
  verificationStatuses: DEFAULT_VERIFICATION_STATUSES,
});

export const CATEGORY_DISPLAY_METADATA: Record<
  CategoryKey,
  { label: string; description: string }
> = {
  caseTypes: {
    label: "Case Types",
    description: "Manage the available program types clients can be enrolled in.",
  },
  caseStatuses: {
    label: "Case Statuses",
    description: "Track where each case is in the review and approval process.",
  },
  alertTypes: {
    label: "Alert Types",
    description: "Configure colors for different alert categories.",
  },
  livingArrangements: {
    label: "Living Arrangements",
    description: "Define the housing situations you want to track for clients.",
  },
  noteCategories: {
    label: "Note Categories",
    description: "Customize how you categorize notes across all cases.",
  },
  verificationStatuses: {
    label: "Verification Statuses",
    description: "Define the workflow stages for verifying financial items.",
  },
};

const dedupe = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of values) {
    const normalized = entry.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
};

const dedupeStatuses = (statuses: StatusConfig[]): StatusConfig[] => {
  const seen = new Set<string>();
  const result: StatusConfig[] = [];
  for (const status of statuses) {
    if (!status || typeof status !== 'object') continue;
    const name = status.name;
    if (typeof name !== 'string') continue;
    const key = name.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ 
      name: name.trim(), 
      colorSlot: isValidColorSlot(status.colorSlot) ? status.colorSlot : 'slate',
      countsAsCompleted: status.countsAsCompleted ?? false,
    });
  }
  return result;
};

const dedupeAlertTypes = (alertTypes: AlertTypeConfig[]): AlertTypeConfig[] => {
  const seen = new Set<string>();
  const result: AlertTypeConfig[] = [];
  for (const alertType of alertTypes) {
    if (!alertType || typeof alertType !== 'object') continue;
    const name = alertType.name;
    if (typeof name !== 'string') continue;
    const key = name.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ 
      name: name.trim(), 
      colorSlot: isValidColorSlot(alertType.colorSlot) ? alertType.colorSlot : 'amber' 
    });
  }
  return result;
};

/**
 * Internal migration: Convert legacy string[] to StatusConfig[]
 * This is also exported from utils/categoryConfigMigration.ts for external use
 */
/** Legacy statuses that should default to countsAsCompleted=true */
const LEGACY_COMPLETION_STATUSES = new Set(['approved', 'denied', 'closed', 'spenddown']);

const normalizeStatusesInternal = (
  value: string[] | StatusConfig[] | undefined | null
): StatusConfig[] => {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return [];
  }
  
  // Check if first item is a string (legacy format)
  const first = value[0];
  if (typeof first === 'string') {
    // Legacy format - migrate
    const usedSlots = new Set<ColorSlot>();
    const migrated = (value as string[]).map((name): StatusConfig | null => {
      const trimmedName = String(name).trim();
      if (!trimmedName) return null;
      
      const defaultColor = DEFAULT_STATUS_COLORS[trimmedName];
      if (defaultColor && !usedSlots.has(defaultColor)) {
        usedSlots.add(defaultColor);
        return { 
          name: trimmedName, 
          colorSlot: defaultColor,
          countsAsCompleted: LEGACY_COMPLETION_STATUSES.has(trimmedName.toLowerCase()),
        };
      }
      
      const colorSlot = autoAssignColorSlot(trimmedName, usedSlots);
      usedSlots.add(colorSlot);
      return { 
        name: trimmedName, 
        colorSlot,
        countsAsCompleted: LEGACY_COMPLETION_STATUSES.has(trimmedName.toLowerCase()),
      };
    });
    return migrated.filter((s): s is StatusConfig => s !== null);
  }
  
  // Already StatusConfig[] format
  return dedupeStatuses(value as StatusConfig[]);
};

/**
 * Internal migration: Convert legacy string[] to AlertTypeConfig[]
 */
const normalizeAlertTypesInternal = (
  value: string[] | AlertTypeConfig[] | undefined | null
): AlertTypeConfig[] => {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return [];
  }
  
  // Check if first item is a string (legacy format)
  const first = value[0];
  if (typeof first === 'string') {
    // Legacy format - migrate
    const usedSlots = new Set<ColorSlot>();
    return (value as string[]).map((name) => {
      const trimmedName = String(name).trim();
      if (!trimmedName) return null;
      
      const defaultColor = DEFAULT_ALERT_COLORS[trimmedName];
      if (defaultColor && !usedSlots.has(defaultColor)) {
        usedSlots.add(defaultColor);
        return { name: trimmedName, colorSlot: defaultColor };
      }
      
      const colorSlot = autoAssignColorSlot(trimmedName, usedSlots);
      usedSlots.add(colorSlot);
      return { name: trimmedName, colorSlot };
    }).filter((s): s is AlertTypeConfig => s !== null);
  }
  
  // Already AlertTypeConfig[] format
  return dedupeAlertTypes(value as AlertTypeConfig[]);
};

export const sanitizeCategoryValues = (values: string[] | undefined | null): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }
  return dedupe(values.map(value => String(value)));
};

export const sanitizeStatusConfigs = (statuses: StatusConfig[] | undefined | null): StatusConfig[] => {
  if (!Array.isArray(statuses)) {
    return [];
  }
  return dedupeStatuses(statuses);
};

/**
 * Merge partial config with defaults.
 * 
 * Automatically handles migration from legacy string[] caseStatuses to StatusConfig[].
 */
export const mergeCategoryConfig = (
  config?: PartialCategoryConfigInput | null,
): CategoryConfig => {
  if (!config) {
    return {
      caseTypes: [...defaultCategoryConfig.caseTypes],
      caseStatuses: defaultCategoryConfig.caseStatuses.map(s => ({ ...s })),
      alertTypes: defaultCategoryConfig.alertTypes.map(a => ({ ...a })),
      livingArrangements: [...defaultCategoryConfig.livingArrangements],
      noteCategories: [...defaultCategoryConfig.noteCategories],
      verificationStatuses: [...defaultCategoryConfig.verificationStatuses],
    };
  }

  // Handle caseStatuses with automatic migration from string[] to StatusConfig[]
  const normalizedStatuses = normalizeStatusesInternal(config.caseStatuses);
  const caseStatuses = normalizedStatuses.length > 0
    ? normalizedStatuses
    : defaultCategoryConfig.caseStatuses.map(s => ({ ...s }));

  // Handle alertTypes with automatic migration from string[] to AlertTypeConfig[]
  const normalizedAlertTypes = normalizeAlertTypesInternal(config.alertTypes);
  const alertTypes = normalizedAlertTypes.length > 0
    ? normalizedAlertTypes
    : defaultCategoryConfig.alertTypes.map(a => ({ ...a }));

  return {
    caseTypes: sanitizeCategoryValues(config.caseTypes).length
      ? sanitizeCategoryValues(config.caseTypes)
      : [...defaultCategoryConfig.caseTypes],
    caseStatuses,
    alertTypes,
    livingArrangements: sanitizeCategoryValues(config.livingArrangements).length
      ? sanitizeCategoryValues(config.livingArrangements)
      : [...defaultCategoryConfig.livingArrangements],
    noteCategories: sanitizeCategoryValues(config.noteCategories).length
      ? sanitizeCategoryValues(config.noteCategories)
      : [...defaultCategoryConfig.noteCategories],
    verificationStatuses: sanitizeCategoryValues(config.verificationStatuses).length
      ? sanitizeCategoryValues(config.verificationStatuses)
      : [...defaultCategoryConfig.verificationStatuses],
  };
};

export const cloneCategoryConfig = (config?: CategoryConfig | null): CategoryConfig => {
  const source = config ?? defaultCategoryConfig;
  return {
    caseTypes: [...source.caseTypes],
    caseStatuses: source.caseStatuses.map(s => ({ 
      name: s.name, 
      colorSlot: s.colorSlot,
      countsAsCompleted: s.countsAsCompleted ?? false,
    })),
    alertTypes: source.alertTypes.map(a => ({ ...a })),
    livingArrangements: [...source.livingArrangements],
    noteCategories: [...source.noteCategories],
    verificationStatuses: [...source.verificationStatuses],
  };
};

/**
 * Ensure a category has at least one value.
 * For caseStatuses, the fallback is added with a 'slate' color.
 */
export const ensureValueInCategory = (
  config: CategoryConfig,
  key: CategoryKey,
  fallback: string,
): CategoryConfig => {
  if (key === 'caseStatuses') {
    if (config.caseStatuses.length > 0) {
      return config;
    }
    return {
      ...config,
      caseStatuses: [{ name: fallback, colorSlot: 'slate', countsAsCompleted: false }],
    };
  }

  const values = sanitizeCategoryValues(config[key] as string[] ?? []);
  if (values.length > 0) {
    return config;
  }

  const updated = { ...config };
  (updated[key] as string[]) = [fallback];
  return updated;
};

/**
 * Helper to get status names as a string array.
 * Useful for components that only need the names.
 */
export const getStatusNames = (config: CategoryConfig): string[] => {
  return config.caseStatuses.map(s => s.name);
};

/**
 * Helper to get statuses that count as completed.
 * Used by dashboard widgets for "cases processed" metrics.
 */
export const getCompletionStatusNames = (config: CategoryConfig): Set<string> => {
  return new Set(
    config.caseStatuses
      .filter(s => s.countsAsCompleted)
      .map(s => s.name.toLowerCase())
  );
};

/**
 * Helper to get alert type names as a string array.
 * Useful for components that only need the names.
 */
export const getAlertTypeNames = (config: CategoryConfig): string[] => {
  return config.alertTypes.map(a => a.name);
};

/**
 * Sanitize and dedupe alert type configs
 */
export const sanitizeAlertTypeConfigs = (alertTypes: AlertTypeConfig[] | undefined | null): AlertTypeConfig[] => {
  if (!Array.isArray(alertTypes)) {
    return [];
  }
  return dedupeAlertTypes(alertTypes);
};
