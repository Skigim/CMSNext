/**
 * @fileoverview Advanced Alert Filtering and Anti-Filtering Logic
 *
 * Pure domain utilities for evaluating alert filter criteria, including
 * exclusion (negated) criteria and date-only comparisons.
 *
 * @module domain/alerts/filtering
 */

import { parseLocalDate } from "@/domain/common";
import type { AlertWithMatch } from "./types";

export type FilterOperator =
  | "equals"
  | "not-equals"
  | "contains"
  | "not-contains"
  | "starts-with"
  | "ends-with"
  | "before"
  | "after"
  | "between"
  | "is-empty"
  | "is-not-empty";

export type FilterableField =
  | "description"
  | "alertType"
  | "alertCode"
  | "program"
  | "region"
  | "personName"
  | "mcNumber"
  | "alertDate"
  | "status"
  | "matchStatus"
  | "source";

export interface FilterCriterion {
  id: string;
  field: FilterableField;
  operator: FilterOperator;
  value: string | string[];
  negate: boolean;
}

export interface AdvancedAlertFilter {
  logic: "and" | "or";
  criteria: FilterCriterion[];
}

export type FilterableFieldType = "text" | "date" | "enum";

const DATE_FIELDS: FilterableField[] = ["alertDate"];
const ENUM_FIELDS: FilterableField[] = ["status", "matchStatus"];
const TEXT_FIELDS: FilterableField[] = [
  "description",
  "alertType",
  "alertCode",
  "program",
  "region",
  "personName",
  "mcNumber",
  "source",
];

const DATE_OPERATORS: FilterOperator[] = [
  "equals",
  "not-equals",
  "before",
  "after",
  "between",
  "is-empty",
  "is-not-empty",
];

const ENUM_OPERATORS: FilterOperator[] = ["equals", "not-equals"];

const TEXT_OPERATORS: FilterOperator[] = [
  "equals",
  "not-equals",
  "contains",
  "not-contains",
  "starts-with",
  "ends-with",
  "is-empty",
  "is-not-empty",
];

const FILTERABLE_FIELD_SET = new Set<FilterableField>([
  ...DATE_FIELDS,
  ...ENUM_FIELDS,
  ...TEXT_FIELDS,
]);

const FILTER_OPERATOR_SET = new Set<FilterOperator>([
  ...DATE_OPERATORS,
  ...ENUM_OPERATORS,
  ...TEXT_OPERATORS,
]);

function createRandomFilterId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `filter-${Math.random().toString(36).slice(2, 10)}`;
}

function isFilterableField(value: unknown): value is FilterableField {
  return typeof value === "string" && FILTERABLE_FIELD_SET.has(value as FilterableField);
}

function isFilterOperator(value: unknown): value is FilterOperator {
  return typeof value === "string" && FILTER_OPERATOR_SET.has(value as FilterOperator);
}

function getFieldType(field: FilterableField): FilterableFieldType {
  if (DATE_FIELDS.includes(field)) return "date";
  if (ENUM_FIELDS.includes(field)) return "enum";
  return "text";
}

function getAlertFieldValue(alert: AlertWithMatch, field: FilterableField): string {
  const value = alert[field];
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function toCriterionValues(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string");
  }
  return [value];
}

function hasUsableValue(criterion: FilterCriterion): boolean {
  if (criterion.operator === "is-empty" || criterion.operator === "is-not-empty") {
    return true;
  }

  if (criterion.operator === "between") {
    return (
      Array.isArray(criterion.value) &&
      criterion.value.length === 2 &&
      criterion.value.every((item) => typeof item === "string" && item.trim().length > 0)
    );
  }

  return toCriterionValues(criterion.value).some((value) => value.trim().length > 0);
}

function evaluateTextLikeOperator(
  fieldValue: string,
  criterion: FilterCriterion,
): boolean {
  const normalizedField = normalize(fieldValue);
  const values = toCriterionValues(criterion.value).map(normalize).filter(Boolean);

  switch (criterion.operator) {
    case "equals":
      return values.includes(normalizedField);
    case "not-equals":
      return values.every((value) => normalizedField !== value);
    case "contains":
      return values.some((value) => normalizedField.includes(value));
    case "not-contains":
      return values.every((value) => !normalizedField.includes(value));
    case "starts-with":
      return values.some((value) => normalizedField.startsWith(value));
    case "ends-with":
      return values.some((value) => normalizedField.endsWith(value));
    case "is-empty":
      return normalizedField.length === 0;
    case "is-not-empty":
      return normalizedField.length > 0;
    default:
      return false;
  }
}

function evaluateDateOperator(fieldValue: string, criterion: FilterCriterion): boolean {
  if (criterion.operator === "is-empty") {
    return fieldValue.trim().length === 0;
  }

  if (criterion.operator === "is-not-empty") {
    return fieldValue.trim().length > 0;
  }

  const sourceDate = parseLocalDate(fieldValue);
  if (!sourceDate) {
    return false;
  }

  const sourceTime = sourceDate.getTime();

  if (criterion.operator === "between") {
    if (!Array.isArray(criterion.value) || criterion.value.length !== 2) {
      return false;
    }

    const [fromRaw, toRaw] = criterion.value;
    const fromDate = parseLocalDate(fromRaw);
    const toDate = parseLocalDate(toRaw);

    if (!fromDate || !toDate) {
      return false;
    }

    const fromTime = fromDate.getTime();
    const toTime = toDate.getTime();

    return sourceTime >= Math.min(fromTime, toTime) && sourceTime <= Math.max(fromTime, toTime);
  }

  const targetRaw = Array.isArray(criterion.value)
    ? criterion.value[0]
    : criterion.value;
  const targetDate = parseLocalDate(targetRaw);

  if (!targetDate) {
    return false;
  }

  const targetTime = targetDate.getTime();

  switch (criterion.operator) {
    case "equals":
      return sourceTime === targetTime;
    case "not-equals":
      return sourceTime !== targetTime;
    case "before":
      return sourceTime < targetTime;
    case "after":
      return sourceTime > targetTime;
    default:
      return false;
  }
}

export function evaluateCriterion(alert: AlertWithMatch, criterion: FilterCriterion): boolean {
  if (!hasUsableValue(criterion)) {
    return true;
  }

  const fieldValue = getAlertFieldValue(alert, criterion.field);
  const fieldType = getFieldType(criterion.field);

  let baseMatch = false;

  if (fieldType === "date") {
    baseMatch = evaluateDateOperator(fieldValue, criterion);
  } else {
    baseMatch = evaluateTextLikeOperator(fieldValue, criterion);
  }

  return criterion.negate ? !baseMatch : baseMatch;
}

export function applyAdvancedFilter(
  alerts: AlertWithMatch[],
  filter: AdvancedAlertFilter,
): AlertWithMatch[] {
  if (!isAdvancedFilterActive(filter)) {
    return alerts;
  }

  const usableCriteria = filter.criteria.filter(hasUsableValue);
  if (usableCriteria.length === 0) {
    return alerts;
  }

  if (filter.logic === "or") {
    return alerts.filter((alert) => usableCriteria.some((criterion) => evaluateCriterion(alert, criterion)));
  }

  return alerts.filter((alert) => usableCriteria.every((criterion) => evaluateCriterion(alert, criterion)));
}

export function isAdvancedFilterActive(filter: AdvancedAlertFilter): boolean {
  return filter.criteria.some(hasUsableValue);
}

export function createEmptyFilterCriterion(field: FilterableField = "description"): FilterCriterion {
  const fieldType = getFieldType(field);
  let operator: FilterOperator = "contains";
  if (fieldType === "date" || fieldType === "enum") {
    operator = "equals";
  }

  return {
    id: createRandomFilterId(),
    field,
    operator,
    value: "",
    negate: false,
  };
}

export function createEmptyAdvancedFilter(): AdvancedAlertFilter {
  return {
    logic: "and",
    criteria: [],
  };
}

export function getOperatorsForField(field: FilterableField): FilterOperator[] {
  const fieldType = getFieldType(field);
  if (fieldType === "date") return DATE_OPERATORS;
  if (fieldType === "enum") return ENUM_OPERATORS;
  return TEXT_OPERATORS;
}

export function getFilterableFields(): {
  field: FilterableField;
  label: string;
  type: FilterableFieldType;
}[] {
  return [
    { field: "description", label: "Description", type: "text" },
    { field: "alertType", label: "Alert Type", type: "text" },
    { field: "alertCode", label: "Alert Code", type: "text" },
    { field: "program", label: "Program", type: "text" },
    { field: "region", label: "Region", type: "text" },
    { field: "personName", label: "Person Name", type: "text" },
    { field: "mcNumber", label: "MCN", type: "text" },
    { field: "alertDate", label: "Alert Date", type: "date" },
    { field: "status", label: "Status", type: "enum" },
    { field: "matchStatus", label: "Match Status", type: "enum" },
    { field: "source", label: "Source", type: "text" },
  ];
}

export function serializeAdvancedFilter(filter: AdvancedAlertFilter): string {
  return JSON.stringify(filter);
}

export function deserializeAdvancedFilter(raw: string): AdvancedAlertFilter | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const logic = (parsed as { logic?: unknown }).logic;
    const criteria = (parsed as { criteria?: unknown }).criteria;

    if ((logic !== "and" && logic !== "or") || !Array.isArray(criteria)) {
      return null;
    }

    const normalizedCriteria: FilterCriterion[] = criteria
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => {
        const field = item.field;
        const operator = item.operator;
        const id = item.id;
        const negate = item.negate;
        const value = item.value;

        if (
          typeof id !== "string" ||
          !isFilterableField(field) ||
          !isFilterOperator(operator) ||
          typeof negate !== "boolean" ||
          !(typeof value === "string" || Array.isArray(value))
        ) {
          return null;
        }

        const safeValue = Array.isArray(value)
          ? value.filter((entry): entry is string => typeof entry === "string")
          : value;

        return {
          id,
          field,
          operator,
          negate,
          value: safeValue,
        } satisfies FilterCriterion;
      })
      .filter((item): item is FilterCriterion => item !== null);

    return {
      logic,
      criteria: normalizedCriteria,
    };
  } catch {
    return null;
  }
}
