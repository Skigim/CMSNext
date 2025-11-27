/**
 * Legacy Data Migration Utility
 * =============================
 * Transforms legacy v1.x nested data format to v2.0 normalized format.
 *
 * Legacy v1.x format:
 * - cases[] with nested person, caseRecord containing financials and notes
 *
 * v2.0 Normalized format:
 * - Flat arrays with foreign keys: cases[], financials[], notes[], alerts[]
 */

import type { NormalizedFileData } from "./services/FileStorageService";
import type {
  StoredCase,
  StoredFinancialItem,
  StoredNote,
  AlertRecord,
  FinancialItem,
  Note,
} from "@/types/case";
import type { CategoryConfig } from "@/types/categoryConfig";
import { mergeCategoryConfig } from "@/types/categoryConfig";
import { discoverStatusesFromCases, discoverAlertTypesFromAlerts } from "./categoryConfigMigration";
import { createLogger } from "./logger";

const logger = createLogger("LegacyMigration");

/**
 * Legacy v1.x case structure (for type reference)
 */
interface LegacyCaseDisplay {
  id: string;
  name: string;
  mcn: string;
  status: string;
  priority: boolean;
  createdAt: string;
  updatedAt: string;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    ssn: string;
    organizationId: string | null;
    livingArrangement: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    mailingAddress: {
      street: string;
      city: string;
      state: string;
      zip: string;
      sameAsPhysical: boolean;
    };
    authorizedRepIds: string[];
    familyMembers: string[];
    status: string;
    createdAt: string;
    dateAdded: string;
  };
  caseRecord: {
    id: string;
    mcn: string;
    applicationDate: string;
    caseType: string;
    personId: string;
    spouseId: string;
    status: string;
    description: string;
    priority: boolean;
    livingArrangement: string;
    withWaiver: boolean;
    admissionDate: string;
    organizationId: string;
    authorizedReps: string[];
    retroRequested: string;
    financials: {
      resources: FinancialItem[];
      income: FinancialItem[];
      expenses: FinancialItem[];
    };
    notes: Note[];
    createdDate: string;
    updatedDate: string;
  };
  alerts?: AlertRecord[];
}

/**
 * Raw legacy file data structure
 */
interface LegacyFileData {
  cases?: LegacyCaseDisplay[];
  exported_at?: string;
  total_cases?: number;
  version?: string;
  categoryConfig?: Partial<CategoryConfig>;
  activityLog?: unknown[];
  // Nightingale raw format
  people?: unknown[];
  caseRecords?: unknown[];
}

/**
 * Migration result with statistics
 */
export interface MigrationResult {
  success: boolean;
  data: NormalizedFileData | null;
  stats: {
    casesCount: number;
    financialsCount: number;
    notesCount: number;
    alertsCount: number;
    errorsCount: number;
  };
  errors: string[];
}

/**
 * Detect the format of raw data
 */
export function detectDataFormat(
  data: unknown,
): "v2.0" | "v1.x-nested" | "nightingale-raw" | "unknown" {
  if (!data || typeof data !== "object") {
    return "unknown";
  }

  const obj = data as Record<string, unknown>;

  // Check for v2.0 normalized format
  if (obj.version === "2.0" && Array.isArray(obj.cases) && Array.isArray(obj.financials)) {
    return "v2.0";
  }

  // Check for Nightingale raw format
  if (Array.isArray(obj.people) && Array.isArray(obj.caseRecords)) {
    return "nightingale-raw";
  }

  // Check for legacy v1.x nested format
  if (Array.isArray(obj.cases) && obj.cases.length > 0) {
    const firstCase = obj.cases[0] as Record<string, unknown>;
    if (firstCase?.caseRecord && typeof firstCase.caseRecord === "object") {
      const caseRecord = firstCase.caseRecord as Record<string, unknown>;
      if ("financials" in caseRecord || "notes" in caseRecord) {
        return "v1.x-nested";
      }
    }
  }

  return "unknown";
}

/**
 * Generate a unique ID for migrated items
 */
function generateMigrationId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Migrate a legacy case to StoredCase format (without nested financials/notes)
 */
function migrateCase(legacyCase: LegacyCaseDisplay): StoredCase {
  const { person, caseRecord } = legacyCase;

  // Create StoredCase without nested financials and notes
  const storedCase: StoredCase = {
    id: legacyCase.id || generateMigrationId("case"),
    name: legacyCase.name || `${person.firstName} ${person.lastName}`.trim(),
    mcn: legacyCase.mcn || caseRecord.mcn,
    status: (legacyCase.status || caseRecord.status || "Pending") as StoredCase["status"],
    priority: legacyCase.priority || caseRecord.priority || false,
    createdAt: legacyCase.createdAt || caseRecord.createdDate || new Date().toISOString(),
    updatedAt: legacyCase.updatedAt || caseRecord.updatedDate || new Date().toISOString(),
    person: {
      ...person,
      id: person.id || generateMigrationId("person"),
      address: person.address || { street: "", city: "", state: "", zip: "" },
      mailingAddress: person.mailingAddress || {
        street: "",
        city: "",
        state: "",
        zip: "",
        sameAsPhysical: true,
      },
      authorizedRepIds: person.authorizedRepIds || [],
      familyMembers: person.familyMembers || [],
      createdAt: person.createdAt || new Date().toISOString(),
      dateAdded: person.dateAdded || new Date().toISOString(),
    },
    caseRecord: {
      id: caseRecord.id || generateMigrationId("record"),
      mcn: caseRecord.mcn || legacyCase.mcn,
      applicationDate: caseRecord.applicationDate || new Date().toISOString().slice(0, 10),
      caseType: caseRecord.caseType || "General",
      personId: caseRecord.personId || person.id,
      spouseId: caseRecord.spouseId || "",
      status: (caseRecord.status || "Pending") as StoredCase["status"],
      description: caseRecord.description || "",
      priority: caseRecord.priority || false,
      livingArrangement: caseRecord.livingArrangement || person.livingArrangement || "",
      withWaiver: caseRecord.withWaiver || false,
      admissionDate: caseRecord.admissionDate || "",
      organizationId: caseRecord.organizationId || "",
      authorizedReps: caseRecord.authorizedReps || [],
      retroRequested: caseRecord.retroRequested || "",
      createdDate: caseRecord.createdDate || new Date().toISOString(),
      updatedDate: caseRecord.updatedDate || new Date().toISOString(),
    },
  };

  return storedCase;
}

/**
 * Extract financial items from a legacy case
 */
function extractFinancials(
  legacyCase: LegacyCaseDisplay,
  caseId: string,
): StoredFinancialItem[] {
  const financials: StoredFinancialItem[] = [];
  const caseFinancials = legacyCase.caseRecord?.financials;

  if (!caseFinancials) {
    return financials;
  }

  const categories: Array<"resources" | "income" | "expenses"> = [
    "resources",
    "income",
    "expenses",
  ];

  for (const category of categories) {
    const items = caseFinancials[category];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      financials.push({
        id: item.id || generateMigrationId("fin"),
        caseId,
        category,
        description: item.description || item.name || "",
        name: item.name,
        location: item.location || "",
        accountNumber: item.accountNumber || "",
        amount: item.amount || 0,
        frequency: item.frequency || "",
        owner: item.owner || "",
        verificationStatus: item.verificationStatus || "Needs VR",
        verificationSource: item.verificationSource || "",
        notes: item.notes || "",
        dateAdded: item.dateAdded || new Date().toISOString(),
        status: item.status,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
      });
    }
  }

  return financials;
}

/**
 * Extract notes from a legacy case
 */
function extractNotes(legacyCase: LegacyCaseDisplay, caseId: string): StoredNote[] {
  const notes: StoredNote[] = [];
  const caseNotes = legacyCase.caseRecord?.notes;

  if (!Array.isArray(caseNotes)) {
    return notes;
  }

  for (const note of caseNotes) {
    notes.push({
      id: note.id || generateMigrationId("note"),
      caseId,
      category: note.category || "General",
      content: note.content || "",
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: note.updatedAt || new Date().toISOString(),
    });
  }

  return notes;
}

/**
 * Extract alerts from legacy cases
 */
function extractAlerts(legacyCases: LegacyCaseDisplay[]): AlertRecord[] {
  const alerts: AlertRecord[] = [];

  for (const legacyCase of legacyCases) {
    if (!Array.isArray(legacyCase.alerts)) continue;

    for (const alert of legacyCase.alerts) {
      // Associate the alert with the case's MCN
      alerts.push({
        ...alert,
        id: alert.id || generateMigrationId("alert"),
        mcNumber: alert.mcNumber || legacyCase.mcn,
        createdAt: alert.createdAt || new Date().toISOString(),
        updatedAt: alert.updatedAt || new Date().toISOString(),
      });
    }
  }

  return alerts;
}

/**
 * Migrate legacy v1.x data to v2.0 normalized format
 */
export function migrateLegacyData(rawData: unknown): MigrationResult {
  const errors: string[] = [];
  const stats = {
    casesCount: 0,
    financialsCount: 0,
    notesCount: 0,
    alertsCount: 0,
    errorsCount: 0,
  };

  try {
    const format = detectDataFormat(rawData);
    logger.info("Starting legacy data migration", { format });

    if (format === "v2.0") {
      logger.info("Data is already in v2.0 format, no migration needed");
      return {
        success: true,
        data: rawData as NormalizedFileData,
        stats,
        errors: ["Data is already in v2.0 format"],
      };
    }

    if (format === "unknown") {
      errors.push("Unknown data format - cannot migrate");
      return { success: false, data: null, stats: { ...stats, errorsCount: 1 }, errors };
    }

    if (format === "nightingale-raw") {
      errors.push(
        "Nightingale raw format migration not yet supported. Please export from Nightingale in a different format.",
      );
      return { success: false, data: null, stats: { ...stats, errorsCount: 1 }, errors };
    }

    // Process v1.x nested format
    const legacyData = rawData as LegacyFileData;
    const legacyCases = (legacyData.cases || []) as LegacyCaseDisplay[];

    const cases: StoredCase[] = [];
    const financials: StoredFinancialItem[] = [];
    const notes: StoredNote[] = [];

    for (let i = 0; i < legacyCases.length; i++) {
      try {
        const legacyCase = legacyCases[i];

        // Migrate the case
        const storedCase = migrateCase(legacyCase);
        cases.push(storedCase);

        // Extract financials
        const caseFinancials = extractFinancials(legacyCase, storedCase.id);
        financials.push(...caseFinancials);

        // Extract notes
        const caseNotes = extractNotes(legacyCase, storedCase.id);
        notes.push(...caseNotes);
      } catch (err) {
        const errorMsg = `Failed to migrate case at index ${i}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(errorMsg);
        logger.warn(errorMsg);
        stats.errorsCount++;
      }
    }

    // Extract alerts
    const alerts = extractAlerts(legacyCases);

    // Build category config with discovered statuses and alert types
    const baseConfig = mergeCategoryConfig(legacyData.categoryConfig);
    const enrichedStatuses = discoverStatusesFromCases(baseConfig.caseStatuses, cases);
    const enrichedAlertTypes = discoverAlertTypesFromAlerts(baseConfig.alertTypes ?? [], alerts);

    const categoryConfig: CategoryConfig = {
      ...baseConfig,
      caseStatuses: enrichedStatuses,
      alertTypes: enrichedAlertTypes,
    };

    // Build normalized data
    const normalizedData: NormalizedFileData = {
      version: "2.0",
      cases,
      financials,
      notes,
      alerts,
      exported_at: new Date().toISOString(),
      total_cases: cases.length,
      categoryConfig,
      activityLog: [],
    };

    stats.casesCount = cases.length;
    stats.financialsCount = financials.length;
    stats.notesCount = notes.length;
    stats.alertsCount = alerts.length;

    logger.info("Migration completed successfully", stats);

    return {
      success: true,
      data: normalizedData,
      stats,
      errors,
    };
  } catch (err) {
    const errorMsg = `Migration failed: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(errorMsg);
    logger.error(errorMsg);
    return {
      success: false,
      data: null,
      stats: { ...stats, errorsCount: stats.errorsCount + 1 },
      errors,
    };
  }
}

/**
 * Get a human-readable description of the detected format
 */
export function getFormatDescription(format: ReturnType<typeof detectDataFormat>): string {
  switch (format) {
    case "v2.0":
      return "v2.0 Normalized Format (current)";
    case "v1.x-nested":
      return "v1.x Nested Format (legacy)";
    case "nightingale-raw":
      return "Nightingale Raw Export";
    default:
      return "Unknown Format";
  }
}
