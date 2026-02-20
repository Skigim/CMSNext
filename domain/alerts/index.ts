/**
 * @fileoverview Alerts Domain Module
 *
 * Exports alert matching, filtering, and indexing logic.
 *
 * @module domain/alerts
 */

// Types
export {
  type AlertMatchStatus,
  type AlertsIndex,
  type AlertsSummary,
  type AlertWithMatch,
  type CaseForAlertMatching,
  workflowPriorityOrder,
} from "./types";

// Matching and filtering logic
export {
  isAlertResolved,
  filterOpenAlerts,
  normalizeMcn,
  createEmptyAlertsIndex,
  buildCaseMap,
  buildAlertStorageKey,
  createRandomAlertId,
  sortAlerts,
  mergeDuplicateAlerts,
  dedupeAlerts,
  createAlertsIndexFromAlerts,
  parseNameFromImport,
  normalizePersonName,
} from "./matching";

// Advanced filtering
export {
  type FilterOperator,
  type FilterableField,
  type FilterableFieldType,
  type FilterCriterion,
  type AdvancedAlertFilter,
  evaluateCriterion,
  applyAdvancedFilter,
  isAdvancedFilterActive,
  partitionCriteria,
  createEmptyFilterCriterion,
  createEmptyAdvancedFilter,
  getOperatorsForField,
  getFilterableFields,
  serializeAdvancedFilter,
  deserializeAdvancedFilter,
} from "./filtering";

// Display utilities
export {
  type AlertDueDateInfo,
  getAlertDisplayDescription,
  getAlertDueDateInfo,
} from "./display";

// Priority weight calculation
export {
  STATUS_WEIGHT_MAX,
  STATUS_WEIGHT_MIN,
  ALERT_WEIGHT_MAX,
  ALERT_WEIGHT_MIN,
  calculateDecayFactor,
  calculatePositionalWeight,
  getAlertTypeWeight,
  getStatusWeight,
  previewWeightDistribution,
} from "./priority";
