import { describe, expect, it } from "vitest";
import {
  discoverStatusesFromCases,
  discoverAlertTypesFromAlerts,
  migrateLegacyStatuses,
  normalizeCaseStatuses,
  isLegacyStatusArray,
  isStatusConfigArray,
} from "@/utils/categoryConfigMigration";
import type { StatusConfig, AlertTypeConfig } from "@/types/categoryConfig";

describe("categoryConfigMigration", () => {
  describe("discoverStatusesFromCases", () => {
    it("preserves existing statuses and adds newly discovered ones", () => {
      const existing: StatusConfig[] = [
        { name: "Active", colorSlot: "green" },
        { name: "Custom Status", colorSlot: "purple" },
      ];
      const cases = [
        { status: "Active" },
        { status: "Pending" },
        { status: "New From Case" },
      ];

      const result = discoverStatusesFromCases(existing, cases);

      // Existing statuses preserved
      expect(result.find((s) => s.name === "Active")).toBeDefined();
      expect(result.find((s) => s.name === "Custom Status")).toBeDefined();

      // Newly discovered statuses added
      expect(result.find((s) => s.name === "Pending")).toBeDefined();
      expect(result.find((s) => s.name === "New From Case")).toBeDefined();

      // Custom status that doesn't match any case is still preserved
      expect(result.find((s) => s.name === "Custom Status")?.colorSlot).toBe(
        "purple"
      );
    });

    it("preserves manually added statuses that have no matching cases", () => {
      const existing: StatusConfig[] = [
        { name: "Future Status", colorSlot: "teal" },
      ];
      const cases = [{ status: "Active" }];

      const result = discoverStatusesFromCases(existing, cases);

      expect(result.find((s) => s.name === "Future Status")).toBeDefined();
      expect(result.find((s) => s.name === "Active")).toBeDefined();
      expect(result).toHaveLength(2);
    });
  });

  describe("discoverAlertTypesFromAlerts", () => {
    it("preserves existing alert types and adds newly discovered ones", () => {
      const existing: AlertTypeConfig[] = [
        { name: "Overdue Documentation", colorSlot: "red" },
        { name: "Custom Alert Type", colorSlot: "purple" },
      ];
      const alerts = [
        { alertType: "Overdue Documentation" },
        { alertType: "Income Verification" },
        { alertType: "New From Alerts" },
      ];

      const result = discoverAlertTypesFromAlerts(existing, alerts);

      // Existing alert types preserved
      expect(result.find((a) => a.name === "Overdue Documentation")).toBeDefined();
      expect(result.find((a) => a.name === "Custom Alert Type")).toBeDefined();

      // Newly discovered alert types added
      expect(result.find((a) => a.name === "Income Verification")).toBeDefined();
      expect(result.find((a) => a.name === "New From Alerts")).toBeDefined();

      // Custom alert type that doesn't match any alert is still preserved
      expect(
        result.find((a) => a.name === "Custom Alert Type")?.colorSlot
      ).toBe("purple");
    });

    it("preserves manually added alert types that have no matching alerts", () => {
      const existing: AlertTypeConfig[] = [
        { name: "Future Alert Type", colorSlot: "teal" },
      ];
      const alerts = [{ alertType: "Overdue Documentation" }];

      const result = discoverAlertTypesFromAlerts(existing, alerts);

      expect(result.find((a) => a.name === "Future Alert Type")).toBeDefined();
      expect(result.find((a) => a.name === "Overdue Documentation")).toBeDefined();
      expect(result).toHaveLength(2);
    });

    it("handles empty alerts array without losing existing config", () => {
      const existing: AlertTypeConfig[] = [
        { name: "Configured Type", colorSlot: "blue" },
        { name: "Another Type", colorSlot: "green" },
      ];
      const alerts: Array<{ alertType?: string }> = [];

      const result = discoverAlertTypesFromAlerts(existing, alerts);

      expect(result).toEqual(existing);
      expect(result).toHaveLength(2);
    });

    it("handles alerts without alertType field", () => {
      const existing: AlertTypeConfig[] = [
        { name: "Configured Type", colorSlot: "blue" },
      ];
      const alerts = [
        { alertType: undefined },
        { alertType: "" },
        { alertType: "Valid Type" },
      ];

      const result = discoverAlertTypesFromAlerts(existing, alerts);

      expect(result).toHaveLength(2);
      expect(result.find((a) => a.name === "Configured Type")).toBeDefined();
      expect(result.find((a) => a.name === "Valid Type")).toBeDefined();
    });

    it("is case-insensitive when matching existing types", () => {
      const existing: AlertTypeConfig[] = [
        { name: "Overdue Documentation", colorSlot: "red" },
      ];
      const alerts = [
        { alertType: "OVERDUE DOCUMENTATION" },
        { alertType: "overdue documentation" },
      ];

      const result = discoverAlertTypesFromAlerts(existing, alerts);

      // Should not add duplicates
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Overdue Documentation");
    });
  });

  describe("migrateLegacyStatuses", () => {
    it("converts string array to StatusConfig array", () => {
      const legacy = ["Active", "Pending", "Closed"];
      const result = migrateLegacyStatuses(legacy);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("Active");
      expect(result[0].colorSlot).toBeDefined();
    });
  });

  describe("normalizeCaseStatuses", () => {
    it("handles undefined input", () => {
      expect(normalizeCaseStatuses(undefined)).toEqual([]);
    });

    it("handles null input", () => {
      expect(normalizeCaseStatuses(null)).toEqual([]);
    });

    it("handles empty array", () => {
      expect(normalizeCaseStatuses([])).toEqual([]);
    });

    it("migrates legacy string array", () => {
      const result = normalizeCaseStatuses(["Active", "Pending"]);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("colorSlot");
    });

    it("passes through StatusConfig array", () => {
      const input: StatusConfig[] = [
        { name: "Active", colorSlot: "green" },
        { name: "Pending", colorSlot: "blue" },
      ];
      const result = normalizeCaseStatuses(input);
      expect(result).toEqual(input);
    });
  });

  describe("isLegacyStatusArray", () => {
    it("returns true for string array", () => {
      expect(isLegacyStatusArray(["Active", "Pending"])).toBe(true);
    });

    it("returns false for StatusConfig array", () => {
      expect(
        isLegacyStatusArray([{ name: "Active", colorSlot: "green" }])
      ).toBe(false);
    });

    it("returns false for empty array", () => {
      expect(isLegacyStatusArray([])).toBe(false);
    });
  });

  describe("isStatusConfigArray", () => {
    it("returns true for StatusConfig array", () => {
      expect(
        isStatusConfigArray([{ name: "Active", colorSlot: "green" }])
      ).toBe(true);
    });

    it("returns true for empty array", () => {
      expect(isStatusConfigArray([])).toBe(true);
    });

    it("returns false for string array", () => {
      expect(isStatusConfigArray(["Active", "Pending"])).toBe(false);
    });
  });
});
