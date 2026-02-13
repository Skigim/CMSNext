import { describe, expect, it } from "vitest";
import {
  applyAdvancedFilter,
  createEmptyAdvancedFilter,
  createEmptyFilterCriterion,
  deserializeAdvancedFilter,
  evaluateCriterion,
  getFilterableFields,
  getOperatorsForField,
  isAdvancedFilterActive,
  serializeAdvancedFilter,
  type AdvancedAlertFilter,
  type AlertWithMatch,
  type FilterCriterion,
} from "@/domain/alerts";

function createAlert(overrides: Partial<AlertWithMatch> = {}): AlertWithMatch {
  return {
    id: "alert-1",
    alertCode: "A100",
    alertType: "Verification",
    alertDate: "2026-02-10",
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-01T10:00:00.000Z",
    mcNumber: "1234567890",
    personName: "Jane Doe",
    program: "MAGI",
    region: "Central",
    source: "Nightingale",
    description: "AVS Day 5",
    status: "new",
    matchStatus: "matched",
    ...overrides,
  };
}

function criterion(overrides: Partial<FilterCriterion>): FilterCriterion {
  return {
    id: "criterion-1",
    field: "description",
    operator: "contains",
    value: "avs",
    negate: false,
    ...overrides,
  };
}

describe("evaluateCriterion", () => {
  it("evaluates equals and not-equals on enum fields", () => {
    const alert = createAlert();

    expect(
      evaluateCriterion(alert, criterion({ field: "status", operator: "equals", value: "new" })),
    ).toBe(true);

    expect(
      evaluateCriterion(alert, criterion({ field: "matchStatus", operator: "not-equals", value: "unmatched" })),
    ).toBe(true);
  });

  it("evaluates text operators", () => {
    const alert = createAlert();

    expect(
      evaluateCriterion(alert, criterion({ field: "description", operator: "contains", value: "day" })),
    ).toBe(true);

    expect(
      evaluateCriterion(alert, criterion({ field: "description", operator: "not-contains", value: "mail" })),
    ).toBe(true);

    expect(
      evaluateCriterion(alert, criterion({ field: "program", operator: "starts-with", value: "ma" })),
    ).toBe(true);

    expect(
      evaluateCriterion(alert, criterion({ field: "region", operator: "ends-with", value: "tral" })),
    ).toBe(true);
  });

  it("handles empty and non-empty checks", () => {
    const alert = createAlert({ source: "", mcNumber: null });

    expect(
      evaluateCriterion(alert, criterion({ field: "source", operator: "is-empty", value: "" })),
    ).toBe(true);

    expect(
      evaluateCriterion(alert, criterion({ field: "mcNumber", operator: "is-empty", value: "" })),
    ).toBe(true);

    expect(
      evaluateCriterion(alert, criterion({ field: "personName", operator: "is-not-empty", value: "" })),
    ).toBe(true);
  });

  it("evaluates date operators with date-only semantics", () => {
    const alert = createAlert({ alertDate: "2026-02-10" });

    expect(
      evaluateCriterion(alert, criterion({ field: "alertDate", operator: "equals", value: "2026-02-10" })),
    ).toBe(true);

    expect(
      evaluateCriterion(alert, criterion({ field: "alertDate", operator: "before", value: "2026-02-11" })),
    ).toBe(true);

    expect(
      evaluateCriterion(alert, criterion({ field: "alertDate", operator: "after", value: "2026-02-09" })),
    ).toBe(true);

    expect(
      evaluateCriterion(alert, criterion({ field: "alertDate", operator: "between", value: ["2026-02-01", "2026-02-10"] })),
    ).toBe(true);
  });

  it("inverts results when negate is true", () => {
    const alert = createAlert();

    expect(
      evaluateCriterion(alert, criterion({ operator: "contains", value: "AVS", negate: true })),
    ).toBe(false);

    expect(
      evaluateCriterion(alert, criterion({ field: "alertDate", operator: "before", value: "2026-02-09", negate: true })),
    ).toBe(true);
  });

  it("treats criteria without usable values as pass-through", () => {
    const alert = createAlert();

    expect(
      evaluateCriterion(alert, criterion({ field: "description", operator: "contains", value: "" })),
    ).toBe(true);

    expect(
      evaluateCriterion(alert, criterion({ field: "alertDate", operator: "between", value: ["", ""] })),
    ).toBe(true);
  });
});

describe("applyAdvancedFilter", () => {
  const alerts = [
    createAlert({ id: "1", description: "AVS Day 5", status: "new", matchStatus: "matched" }),
    createAlert({ id: "2", description: "Verification Due", status: "in-progress", matchStatus: "unmatched" }),
    createAlert({ id: "3", description: "Mail Rcvd Closed", status: "resolved", matchStatus: "missing-mcn" }),
  ];

  it("returns all alerts for empty criteria", () => {
    const filter: AdvancedAlertFilter = { logic: "and", criteria: [] };
    expect(applyAdvancedFilter(alerts, filter)).toHaveLength(3);
  });

  it("applies AND logic", () => {
    const filter: AdvancedAlertFilter = {
      logic: "and",
      criteria: [
        criterion({ field: "description", operator: "contains", value: "verification" }),
        criterion({ field: "status", operator: "equals", value: "in-progress", id: "2" }),
      ],
    };

    const result = applyAdvancedFilter(alerts, filter);
    expect(result.map((item) => item.id)).toEqual(["2"]);
  });

  it("applies OR logic", () => {
    const filter: AdvancedAlertFilter = {
      logic: "or",
      criteria: [
        criterion({ field: "status", operator: "equals", value: "resolved" }),
        criterion({ field: "matchStatus", operator: "equals", value: "matched", id: "2" }),
      ],
    };

    const result = applyAdvancedFilter(alerts, filter);
    expect(result.map((item) => item.id)).toEqual(["1", "3"]);
  });

  it("supports mixed include and anti-filter criteria", () => {
    const filter: AdvancedAlertFilter = {
      logic: "and",
      criteria: [
        criterion({ field: "description", operator: "contains", value: "day" }),
        criterion({ field: "status", operator: "equals", value: "resolved", negate: true, id: "2" }),
      ],
    };

    const result = applyAdvancedFilter(alerts, filter);
    expect(result.map((item) => item.id)).toEqual(["1"]);
  });

  it("handles empty alerts arrays", () => {
    const filter: AdvancedAlertFilter = {
      logic: "and",
      criteria: [criterion({ field: "status", operator: "equals", value: "new" })],
    };

    expect(applyAdvancedFilter([], filter)).toEqual([]);
  });

  it("handles all-negated criteria", () => {
    const filter: AdvancedAlertFilter = {
      logic: "and",
      criteria: [
        criterion({ field: "description", operator: "contains", value: "mail", negate: true }),
      ],
    };

    const result = applyAdvancedFilter(alerts, filter);
    expect(result.map((item) => item.id)).toEqual(["1", "2"]);
  });
});

describe("helpers", () => {
  it("detects active filter state", () => {
    expect(isAdvancedFilterActive(createEmptyAdvancedFilter())).toBe(false);

    expect(
      isAdvancedFilterActive({
        logic: "and",
        criteria: [criterion({ value: "" })],
      }),
    ).toBe(false);

    expect(
      isAdvancedFilterActive({
        logic: "and",
        criteria: [criterion({ value: "AVS" })],
      }),
    ).toBe(true);
  });

  it("returns expected operators by field", () => {
    const dateOperators = getOperatorsForField("alertDate");
    const textOperators = getOperatorsForField("description");
    const enumOperators = getOperatorsForField("status");

    expect(dateOperators).toContain("between");
    expect(dateOperators).toContain("before");
    expect(textOperators).toContain("contains");
    expect(textOperators).toContain("not-contains");
    expect(enumOperators).toEqual(["equals", "not-equals"]);
  });

  it("provides metadata for filterable fields", () => {
    const fields = getFilterableFields();
    expect(fields.some((entry) => entry.field === "alertDate" && entry.type === "date")).toBe(true);
    expect(fields.some((entry) => entry.field === "status" && entry.type === "enum")).toBe(true);
    expect(fields.some((entry) => entry.field === "description" && entry.type === "text")).toBe(true);
  });

  it("creates empty criterion and filter factories", () => {
    const emptyCriterion = createEmptyFilterCriterion("description");
    const emptyFilter = createEmptyAdvancedFilter();

    expect(emptyCriterion.id.length).toBeGreaterThan(0);
    expect(emptyCriterion.field).toBe("description");
    expect(emptyCriterion.negate).toBe(false);
    expect(emptyFilter.logic).toBe("and");
    expect(emptyFilter.criteria).toEqual([]);
  });

  it("serializes and deserializes filter payloads", () => {
    const filter: AdvancedAlertFilter = {
      logic: "or",
      criteria: [criterion({ field: "status", operator: "equals", value: "new" })],
    };

    const raw = serializeAdvancedFilter(filter);
    const parsed = deserializeAdvancedFilter(raw);

    expect(parsed).toEqual(filter);
  });

  it("returns null for invalid serialized payloads", () => {
    expect(deserializeAdvancedFilter("not-json")).toBeNull();
    expect(deserializeAdvancedFilter(JSON.stringify({ logic: "xor", criteria: [] }))).toBeNull();
    expect(deserializeAdvancedFilter(JSON.stringify({ logic: "and", criteria: "bad" }))).toBeNull();
  });
});
