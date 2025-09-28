export type CategoryKey =
  | "caseTypes"
  | "caseStatuses"
  | "livingArrangements"
  | "noteCategories";

export interface CategoryConfig {
  caseTypes: string[];
  caseStatuses: string[];
  livingArrangements: string[];
  noteCategories: string[];
}

export type PartialCategoryConfig = Partial<Record<CategoryKey, string[]>>;

const DEFAULT_CASE_TYPES = [
  "LTC",
  "Medicaid",
  "SNAP",
  "TANF",
  "Emergency",
  "Other",
];

const DEFAULT_CASE_STATUSES = ["Pending", "Approved", "Denied", "Spenddown"];

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

export const defaultCategoryConfig: CategoryConfig = Object.freeze({
  caseTypes: DEFAULT_CASE_TYPES,
  caseStatuses: DEFAULT_CASE_STATUSES,
  livingArrangements: DEFAULT_LIVING_ARRANGEMENTS,
  noteCategories: DEFAULT_NOTE_CATEGORIES,
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
  livingArrangements: {
    label: "Living Arrangements",
    description: "Define the housing situations you want to track for clients.",
  },
  noteCategories: {
    label: "Note Categories",
    description: "Customize how you categorize notes across all cases.",
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

export const sanitizeCategoryValues = (values: string[] | undefined | null): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }
  return dedupe(values.map(value => String(value)));
};

export const mergeCategoryConfig = (
  config?: PartialCategoryConfig | null,
): CategoryConfig => {
  if (!config) {
    return {
      caseTypes: [...defaultCategoryConfig.caseTypes],
      caseStatuses: [...defaultCategoryConfig.caseStatuses],
      livingArrangements: [...defaultCategoryConfig.livingArrangements],
      noteCategories: [...defaultCategoryConfig.noteCategories],
    };
  }

  const sanitizedEntries = Object.entries(config).reduce<PartialCategoryConfig>((acc, [key, values]) => {
    const categoryKey = key as CategoryKey;
    acc[categoryKey] = sanitizeCategoryValues(values);
    return acc;
  }, {});

  return {
    caseTypes: sanitizedEntries.caseTypes?.length
      ? sanitizedEntries.caseTypes
      : [...defaultCategoryConfig.caseTypes],
    caseStatuses: sanitizedEntries.caseStatuses?.length
      ? sanitizedEntries.caseStatuses
      : [...defaultCategoryConfig.caseStatuses],
    livingArrangements: sanitizedEntries.livingArrangements?.length
      ? sanitizedEntries.livingArrangements
      : [...defaultCategoryConfig.livingArrangements],
    noteCategories: sanitizedEntries.noteCategories?.length
      ? sanitizedEntries.noteCategories
      : [...defaultCategoryConfig.noteCategories],
  };
};

export const cloneCategoryConfig = (config?: CategoryConfig | null): CategoryConfig => {
  const source = config ?? defaultCategoryConfig;
  return {
    caseTypes: [...source.caseTypes],
    caseStatuses: [...source.caseStatuses],
    livingArrangements: [...source.livingArrangements],
    noteCategories: [...source.noteCategories],
  };
};

export const ensureValueInCategory = (
  config: CategoryConfig,
  key: CategoryKey,
  fallback: string,
): CategoryConfig => {
  const values = sanitizeCategoryValues(config[key] ?? []);
  if (values.length > 0) {
    return config;
  }

  const updated = { ...config };
  updated[key] = [fallback];
  return updated;
};
