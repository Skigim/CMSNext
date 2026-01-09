import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseLocalDate,
  formatDateForDisplay,
  formatShortDate,
  formatDateTime,
  isoToDateInputValue,
  dateInputValueToISO,
  toLocalDateString,
} from "../dates";

describe("dates", () => {
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

  describe("toLocalDateString", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns date in YYYY-MM-DD format", () => {
      vi.setSystemTime(new Date(2026, 0, 5, 10, 30, 0)); // Jan 5, 2026 10:30am local
      expect(toLocalDateString()).toBe("2026-01-05");
    });

    it("pads single-digit months and days", () => {
      vi.setSystemTime(new Date(2026, 0, 5)); // Jan 5
      expect(toLocalDateString()).toBe("2026-01-05");

      vi.setSystemTime(new Date(2026, 11, 25)); // Dec 25
      expect(toLocalDateString()).toBe("2026-12-25");
    });

    it("does NOT shift to next day for evening times (unlike toISOString)", () => {
      // This is the key fix - simulating late evening in local time
      // In UTC this would be the next day, but local date should stay the same
      vi.setSystemTime(new Date(2026, 0, 5, 22, 0, 0)); // Jan 5, 2026 10pm local
      expect(toLocalDateString()).toBe("2026-01-05");
    });

    it("accepts a custom date", () => {
      const customDate = new Date(2025, 5, 15); // June 15, 2025
      expect(toLocalDateString(customDate)).toBe("2025-06-15");
    });
  });
});
