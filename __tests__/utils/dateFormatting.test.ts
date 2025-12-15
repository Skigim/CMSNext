import { describe, it, expect } from "vitest";
import {
  parseLocalDate,
  formatDateForDisplay,
  formatShortDate,
  formatDateTime,
  isoToDateInputValue,
  dateInputValueToISO,
} from "@/utils/dateFormatting";

describe("dateFormatting", () => {
  describe("parseLocalDate", () => {
    it("parses yyyy-MM-dd as local midnight (not UTC)", () => {
      const date = parseLocalDate("2024-12-15");
      expect(date).not.toBeNull();
      expect(date!.getDate()).toBe(15);
      expect(date!.getMonth()).toBe(11); // December is 11
      expect(date!.getFullYear()).toBe(2024);
    });

    it("handles ISO timestamps correctly", () => {
      const date = parseLocalDate("2024-12-15T14:30:00.000Z");
      expect(date).not.toBeNull();
      // This will be converted to local time, so exact date depends on timezone
      expect(date!.getFullYear()).toBe(2024);
    });

    it("returns null for invalid date", () => {
      expect(parseLocalDate("invalid")).toBeNull();
      expect(parseLocalDate(null)).toBeNull();
      expect(parseLocalDate(undefined)).toBeNull();
      expect(parseLocalDate("")).toBeNull();
    });
  });

  describe("formatDateForDisplay", () => {
    it("formats yyyy-MM-dd correctly without timezone shift", () => {
      // This is the key test - the date should NOT shift backward
      const result = formatDateForDisplay("2024-12-15");
      expect(result).toBe("12/15/2024");
    });

    it("formats ISO timestamp correctly", () => {
      // ISO timestamps may display differently based on local timezone
      const result = formatDateForDisplay("2024-12-15T00:00:00.000Z");
      expect(result).toMatch(/\d{2}\/\d{2}\/2024/);
    });

    it("returns None for null/undefined/empty", () => {
      expect(formatDateForDisplay(null)).toBe("None");
      expect(formatDateForDisplay(undefined)).toBe("None");
      expect(formatDateForDisplay("")).toBe("None");
    });

    it("returns None for invalid date", () => {
      expect(formatDateForDisplay("invalid")).toBe("None");
    });
  });

  describe("formatShortDate", () => {
    it("formats as short month and day", () => {
      const result = formatShortDate("2024-12-15");
      expect(result).toBe("Dec 15");
    });

    it("returns empty string for null/undefined", () => {
      expect(formatShortDate(null)).toBe("");
      expect(formatShortDate(undefined)).toBe("");
    });
  });

  describe("formatDateTime", () => {
    it("includes time in formatted output", () => {
      const result = formatDateTime("2024-12-15T14:30:00");
      expect(result).toMatch(/Dec 15, 2024/);
      expect(result).toMatch(/\d{1,2}:\d{2}/); // Has time component
    });

    it("returns empty string for null/undefined", () => {
      expect(formatDateTime(null)).toBe("");
      expect(formatDateTime(undefined)).toBe("");
    });
  });

  describe("isoToDateInputValue", () => {
    it("extracts date from ISO timestamp", () => {
      expect(isoToDateInputValue("2024-12-15T14:30:00.000Z")).toMatch(/2024-12-1[45]/);
    });

    it("passes through yyyy-MM-dd unchanged", () => {
      expect(isoToDateInputValue("2024-12-15")).toBe("2024-12-15");
    });

    it("returns empty for null/undefined", () => {
      expect(isoToDateInputValue(null)).toBe("");
      expect(isoToDateInputValue(undefined)).toBe("");
    });
  });

  describe("dateInputValueToISO", () => {
    it("returns yyyy-MM-dd unchanged (no time component)", () => {
      expect(dateInputValueToISO("2024-12-15")).toBe("2024-12-15");
    });

    it("extracts date from ISO timestamp", () => {
      const result = dateInputValueToISO("2024-12-15T14:30:00.000Z");
      expect(result).toMatch(/2024-12-1[45]/);
    });

    it("returns null for null/undefined/empty", () => {
      expect(dateInputValueToISO(null)).toBeNull();
      expect(dateInputValueToISO(undefined)).toBeNull();
      expect(dateInputValueToISO("")).toBeNull();
    });
  });
});
