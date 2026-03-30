import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getFirstOfMonth,
  getLastOfMonth,
  isDateInEntryRange,
  getAmountForMonth,
  getAmountInfoForMonth,
  getEntryForMonth,
  sortHistoryEntries,
  getLatestHistoryEntry,
  createHistoryEntry,
  closePreviousOngoingEntry,
  getAutoEndDateForNewEntry,
  addHistoryEntryToItem,
  updateHistoryEntry,
  deleteHistoryEntry,
  formatHistoryDate,
  formatMonthYear,
} from "../history";
import type { FinancialItem } from "@/types/case";
import { createMockAmountHistoryEntry } from "@/src/test/testUtils";

// Mock uuid for consistent IDs in tests
vi.mock("uuid", () => ({
  v4: () => "test-uuid-1234",
}));

const localDate = (year: number, month: number, day: number): Date =>
  new Date(year, month - 1, day);

// Shared base financial item used across multiple describe blocks
const baseItem: FinancialItem = {
  id: "item-1",
  description: "Test Item",
  amount: 500,
  verificationStatus: "Verified",
};

describe("financialHistory utilities", () => {
  describe("getFirstOfMonth", () => {
    it("returns the first day of the current month", () => {
      const date = new Date(2025, 5, 15); // June 15, 2025
      const result = getFirstOfMonth(date);
      expect(result).toContain("2025-06-01");
    });

    it("defaults to current date when no argument provided", () => {
      const result = getFirstOfMonth();
      const today = new Date();
      expect(result).toContain(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`);
    });
  });

  describe("getLastOfMonth", () => {
    it("returns the last day of the month", () => {
      const date = new Date(2025, 5, 15); // June 15, 2025
      const result = getLastOfMonth(date);
      expect(result).toContain("2025-06-30");
    });

    it("handles months with 31 days", () => {
      const date = new Date(2025, 6, 10); // July 10, 2025
      const result = getLastOfMonth(date);
      expect(result).toContain("2025-07-31");
    });

    it("handles February in a non-leap year", () => {
      const date = new Date(2025, 1, 10); // February 10, 2025
      const result = getLastOfMonth(date);
      expect(result).toContain("2025-02-28");
    });
  });

  describe("isDateInEntryRange", () => {
    const entry = createMockAmountHistoryEntry({
      startDate: "2025-06-01",
      endDate: "2025-06-30",
      createdAt: "2025-06-01",
    });

    it("returns true for date within range", () => {
      const targetDate = localDate(2025, 6, 15);
      expect(isDateInEntryRange(entry, targetDate)).toBe(true);
    });

    it("returns true for date on start boundary", () => {
      const targetDate = localDate(2025, 6, 1);
      expect(isDateInEntryRange(entry, targetDate)).toBe(true);
    });

    it("returns true for date on end boundary", () => {
      const targetDate = localDate(2025, 6, 30);
      expect(isDateInEntryRange(entry, targetDate)).toBe(true);
    });

    it("returns false for date before range", () => {
      const targetDate = localDate(2025, 5, 31);
      expect(isDateInEntryRange(entry, targetDate)).toBe(false);
    });

    it("returns false for date after range", () => {
      const targetDate = localDate(2025, 7, 1);
      expect(isDateInEntryRange(entry, targetDate)).toBe(false);
    });

    it("returns true for ongoing entry (no endDate) if date >= startDate", () => {
      const ongoingEntry = createMockAmountHistoryEntry({
        id: "2",
        amount: 2000,
        startDate: "2025-06-01",
        createdAt: "2025-06-01",
      });
      expect(isDateInEntryRange(ongoingEntry, localDate(2025, 12, 15))).toBe(true);
    });
  });

  describe("getAmountForMonth", () => {
    it("returns item.amount when no amountHistory exists", () => {
      expect(getAmountForMonth(baseItem, localDate(2025, 6, 15))).toBe(500);
    });

    it("returns item.amount when amountHistory is empty", () => {
      const itemWithEmptyHistory = { ...baseItem, amountHistory: [] };
      expect(getAmountForMonth(itemWithEmptyHistory, localDate(2025, 6, 15))).toBe(500);
    });

    it("returns matching entry amount when history exists", () => {
      const itemWithHistory: FinancialItem = {
        ...baseItem,
        amountHistory: [
          createMockAmountHistoryEntry({ startDate: "2025-06-01", createdAt: "2025-06-01" }),
        ],
      };
      expect(getAmountForMonth(itemWithHistory, localDate(2025, 6, 15))).toBe(1000);
    });

    it("returns most recent applicable entry for multiple entries", () => {
      const itemWithMultipleHistory: FinancialItem = {
        ...baseItem,
        amountHistory: [
          createMockAmountHistoryEntry({ startDate: "2025-05-01", endDate: "2025-05-31", createdAt: "2025-05-01" }),
          createMockAmountHistoryEntry({ id: "entry-test-2", amount: 1500, startDate: "2025-06-01", createdAt: "2025-06-01" }),
        ],
      };
      expect(getAmountForMonth(itemWithMultipleHistory, localDate(2025, 6, 15))).toBe(1500);
      expect(getAmountForMonth(itemWithMultipleHistory, localDate(2025, 5, 15))).toBe(1000);
    });

    it("falls back to most recent past entry when no entry covers the date", () => {
      const itemWithHistory: FinancialItem = {
        ...baseItem,
        amountHistory: [
          createMockAmountHistoryEntry({ startDate: "2025-06-01", endDate: "2025-06-30", createdAt: "2025-06-01" }),
        ],
      };
      // Requesting amount for July when only June is covered - should fall back to June's amount
      expect(getAmountForMonth(itemWithHistory, localDate(2025, 7, 15))).toBe(1000);
    });

    it("falls back to item.amount when no history entries exist", () => {
      expect(getAmountForMonth(baseItem, localDate(2025, 7, 15))).toBe(500);
    });
  });

  describe("getAmountInfoForMonth", () => {
    it("returns isLegacyFallback=true when no history exists", () => {
      const result = getAmountInfoForMonth(baseItem, localDate(2025, 6, 15));
      expect(result.amount).toBe(500);
      expect(result.entry).toBeUndefined();
      expect(result.isFallback).toBe(false);
      expect(result.isLegacyFallback).toBe(true);
    });

    it("returns exact match with no fallback flags", () => {
      const entry = createMockAmountHistoryEntry({ startDate: "2025-06-01", createdAt: "2025-06-01" });
      const itemWithHistory = { ...baseItem, amountHistory: [entry] };
      const result = getAmountInfoForMonth(itemWithHistory, localDate(2025, 6, 15));
      expect(result.amount).toBe(1000);
      expect(result.entry).toEqual(entry);
      expect(result.isFallback).toBe(false);
      expect(result.isLegacyFallback).toBe(false);
    });

    it("returns isFallback=true when using a past entry", () => {
      const entry = createMockAmountHistoryEntry({
        startDate: "2025-06-01",
        endDate: "2025-06-30",
        createdAt: "2025-06-01",
      });
      const itemWithHistory = { ...baseItem, amountHistory: [entry] };
      // July 15 is after June 30 end date
      const result = getAmountInfoForMonth(itemWithHistory, localDate(2025, 7, 15));
      expect(result.amount).toBe(1000);
      expect(result.entry).toEqual(entry);
      expect(result.isFallback).toBe(true);
      expect(result.isLegacyFallback).toBe(false);
    });
  });

  describe("getEntryForMonth", () => {
    it("returns undefined when no amountHistory exists", () => {
      expect(getEntryForMonth(baseItem, localDate(2025, 6, 15))).toBeUndefined();
    });

    it("returns the matching entry", () => {
      const entry = createMockAmountHistoryEntry({ startDate: "2025-06-01", createdAt: "2025-06-01" });
      const itemWithHistory = { ...baseItem, amountHistory: [entry] };
      expect(getEntryForMonth(itemWithHistory, localDate(2025, 6, 15))).toEqual(entry);
    });
  });

  describe("sortHistoryEntries", () => {
    it("sorts entries by startDate in descending order (most recent first)", () => {
      const entries = [
        createMockAmountHistoryEntry({ id: "entry-test-1", amount: 100, startDate: "2025-04-01", createdAt: "" }),
        createMockAmountHistoryEntry({ id: "entry-test-2", amount: 200, startDate: "2025-06-01", createdAt: "" }),
        createMockAmountHistoryEntry({ id: "entry-test-3", amount: 300, startDate: "2025-05-01", createdAt: "" }),
      ];

      const sorted = sortHistoryEntries(entries);
      expect(sorted[0].id).toBe("entry-test-2"); // June
      expect(sorted[1].id).toBe("entry-test-3"); // May
      expect(sorted[2].id).toBe("entry-test-1"); // April
    });

    it("does not mutate the original array", () => {
      const entries = [
        createMockAmountHistoryEntry({ id: "entry-test-1", amount: 100, startDate: "2025-04-01", createdAt: "" }),
        createMockAmountHistoryEntry({ id: "entry-test-2", amount: 200, startDate: "2025-06-01", createdAt: "" }),
      ];

      const sorted = sortHistoryEntries(entries);
      expect(entries[0].id).toBe("entry-test-1"); // Original unchanged
      expect(sorted[0].id).toBe("entry-test-2");
    });

    it("sorts valid dates ahead of invalid dates using parsed date values", () => {
      // ARRANGE
      const entries = [
        createMockAmountHistoryEntry({ id: "entry-invalid", startDate: "not-a-date", createdAt: "" }),
        createMockAmountHistoryEntry({ id: "entry-march", startDate: "2026-03-01", createdAt: "" }),
        createMockAmountHistoryEntry({ id: "entry-late-march", startDate: "2026-03-24", createdAt: "" }),
      ];

      // ACT
      const sorted = sortHistoryEntries(entries);

      // ASSERT
      expect(sorted.map((entry) => entry.id)).toEqual([
        "entry-late-march",
        "entry-march",
        "entry-invalid",
      ]);
    });
  });

  describe("getLatestHistoryEntry", () => {
    it("returns undefined when history is empty", () => {
      // ACT & ASSERT
      expect(getLatestHistoryEntry([])).toBeUndefined();
      expect(getLatestHistoryEntry(undefined)).toBeUndefined();
    });

    it("selects the latest entry even when history is out of order", () => {
      // ARRANGE
      const olderEntry = createMockAmountHistoryEntry({
        id: "entry-older",
        startDate: "2026-03-01",
        createdAt: "2026-03-01T00:00:00.000Z",
      });
      const latestEntry = createMockAmountHistoryEntry({
        id: "entry-latest",
        startDate: "2026-03-24",
        createdAt: "2026-03-24T00:00:00.000Z",
      });

      // ACT
      const result = getLatestHistoryEntry([olderEntry, latestEntry]);

      // ASSERT
      expect(result).toEqual(latestEntry);
    });

    it("ignores invalid or missing start dates when selecting the latest entry", () => {
      // ARRANGE
      const invalidEntry = createMockAmountHistoryEntry({
        id: "entry-invalid",
        startDate: "",
        createdAt: "2026-03-25T00:00:00.000Z",
      });
      const olderEntry = createMockAmountHistoryEntry({
        id: "entry-older",
        startDate: "2026-03-01",
        createdAt: "2026-03-01T00:00:00.000Z",
      });
      const latestEntry = createMockAmountHistoryEntry({
        id: "entry-latest",
        startDate: "2026-03-24",
        createdAt: "2026-03-24T00:00:00.000Z",
      });

      // ACT
      const result = getLatestHistoryEntry([invalidEntry, olderEntry, latestEntry]);

      // ASSERT
      expect(result).toEqual(latestEntry);
    });

    it("uses createdAt as a deterministic tiebreaker when start dates match", () => {
      // ARRANGE
      const earlierEntry = createMockAmountHistoryEntry({
        id: "entry-earlier",
        startDate: "2026-03-24",
        createdAt: "2026-03-24T08:00:00.000Z",
      });
      const laterEntry = createMockAmountHistoryEntry({
        id: "entry-later",
        startDate: "2026-03-24",
        createdAt: "2026-03-24T12:00:00.000Z",
      });

      // ACT
      const result = getLatestHistoryEntry([earlierEntry, laterEntry]);

      // ASSERT
      expect(result).toEqual(laterEntry);
    });
  });

  describe("createHistoryEntry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(localDate(2025, 6, 15));
    });

    it("creates entry with provided amount and default startDate", () => {
      const entry = createHistoryEntry(1500);
      expect(entry.amount).toBe(1500);
      expect(entry.startDate).toContain("2025-06-01");
      expect(entry.endDate).toBeNull();
      expect(entry.id).toBe("test-uuid-1234");
    });

    it("uses provided startDate", () => {
      const entry = createHistoryEntry(1500, "2025-05-01");
      expect(entry.startDate).toBe("2025-05-01");
    });

    it("includes optional endDate and verificationSource", () => {
      const entry = createHistoryEntry(1500, undefined, {
        endDate: "2025-06-30",
        verificationSource: "Bank Statement",
      });
      expect(entry.endDate).toBe("2025-06-30");
      expect(entry.verificationSource).toBe("Bank Statement");
    });
  });

  describe("closePreviousOngoingEntry", () => {
    it("closes ongoing entries that start before new entry", () => {
      const history = [
        createMockAmountHistoryEntry({ startDate: "2025-05-01", createdAt: "2025-05-01" }),
      ];

      const updated = closePreviousOngoingEntry(history, "2025-06-01");
      expect(updated[0].endDate).toContain("2025-05-31");
    });

    it.each([
      {
        label: "sets end date to last day of month prior to new entry start month",
        startDate: "2025-09-01",
        newEntryStart: "2025-10-15", // mid-October → prior month is September → 09/30
        expectedEndDate: "2025-09-30",
      },
      {
        label: "handles year boundary correctly (new entry in January)",
        startDate: "2024-12-01",
        newEntryStart: "2025-01-01", // January 2025 → prior month is December 2024
        expectedEndDate: "2024-12-31",
      },
      {
        label: "clamps end date to entry start date when new entry is in the same month",
        startDate: "2025-10-01",
        newEntryStart: "2025-10-15", // same month → prior-month-end (09/30) < startDate (10/01) → clamp
        expectedEndDate: "2025-10-01",
      },
    ])("$label", ({ startDate, newEntryStart, expectedEndDate }) => {
      const history = [
        createMockAmountHistoryEntry({ startDate, endDate: null, createdAt: startDate }),
      ];
      const updated = closePreviousOngoingEntry(history, newEntryStart);
      expect(updated[0].endDate).toBe(expectedEndDate);
    });

    it("does not modify entries that already have endDate", () => {
      const history = [
        createMockAmountHistoryEntry({ startDate: "2025-05-01", endDate: "2025-05-15", createdAt: "2025-05-01" }),
      ];

      const updated = closePreviousOngoingEntry(history, "2025-06-01");
      expect(updated[0].endDate).toBe("2025-05-15");
    });

    it("returns empty array for empty input", () => {
      expect(closePreviousOngoingEntry([], "2025-06-01")).toEqual([]);
    });
  });

  describe("getAutoEndDateForNewEntry", () => {
    it("returns null when history is empty", () => {
      expect(getAutoEndDateForNewEntry([], "2025-09-01")).toBeNull();
    });

    it("returns null when no entries start after the new entry's start date", () => {
      const history = [
        createMockAmountHistoryEntry({ startDate: "2025-08-01", createdAt: "2025-08-01" }),
      ];
      expect(getAutoEndDateForNewEntry(history, "2025-09-01")).toBeNull();
    });

    it("returns last day of month prior to earliest later entry", () => {
      const history = [
        createMockAmountHistoryEntry({ startDate: "2025-10-01", createdAt: "2025-10-01" }),
      ];
      // New entry starts 09/01 → next entry is 10/01 → auto end = 09/30
      expect(getAutoEndDateForNewEntry(history, "2025-09-01")).toBe("2025-09-30");
    });

    it("picks the earliest later entry when multiple later entries exist", () => {
      const history = [
        createMockAmountHistoryEntry({ id: "entry-test-1", startDate: "2025-11-01", createdAt: "2025-11-01" }),
        createMockAmountHistoryEntry({ id: "entry-test-2", amount: 1200, startDate: "2025-10-01", createdAt: "2025-10-01" }),
      ];
      // New entry starts 09/01 → earliest later is 10/01 → auto end = 09/30
      expect(getAutoEndDateForNewEntry(history, "2025-09-01")).toBe("2025-09-30");
    });

    it("handles year boundary correctly", () => {
      const history = [
        createMockAmountHistoryEntry({ startDate: "2025-01-01", createdAt: "2025-01-01" }),
      ];
      // New entry starts 12/01/2024 → next entry is 01/01/2025 → auto end = 12/31/2024
      expect(getAutoEndDateForNewEntry(history, "2024-12-01")).toBe("2024-12-31");
    });

    it("returns null for an invalid new entry start date", () => {
      const history = [
        createMockAmountHistoryEntry({ startDate: "2025-10-01", createdAt: "2025-10-01" }),
      ];
      expect(getAutoEndDateForNewEntry(history, "not-a-date")).toBeNull();
    });

    it("does not consider entries with the same start date as 'later'", () => {
      const history = [
        createMockAmountHistoryEntry({ startDate: "2025-09-01", createdAt: "2025-09-01" }),
      ];
      // Same start date → not a "later" entry → null
      expect(getAutoEndDateForNewEntry(history, "2025-09-01")).toBeNull();
    });

    it("clamps end date to newEntryStartDate when earliest later entry is in the same month on a later day", () => {
      const history = [
        createMockAmountHistoryEntry({ startDate: "2025-09-20", createdAt: "2025-09-20" }),
      ];
      // New entry starts 09/15, later entry starts 09/20 (same month)
      // Prior month end = 08/31, but 08/31 < 09/15 → clamped to 09/15
      expect(getAutoEndDateForNewEntry(history, "2025-09-15")).toBe("2025-09-15");
    });
  });

  describe("addHistoryEntryToItem", () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it("adds new entry to item with no history", () => {
      const item: FinancialItem = {
        id: "item-1",
        description: "Test",
        amount: 500,
        verificationStatus: "Verified",
      };

      const newEntry = createMockAmountHistoryEntry({ id: "entry-1", startDate: "2025-06-01", createdAt: "2025-06-01" });

      const updated = addHistoryEntryToItem(item, newEntry);
      expect(updated.amountHistory).toHaveLength(1);
      expect(updated.amountHistory![0].amount).toBe(1000);
    });

    it("closes previous ongoing entry when adding new one", () => {
      const item: FinancialItem = {
        id: "item-1",
        description: "Test",
        amount: 500,
        verificationStatus: "Verified",
        amountHistory: [
          createMockAmountHistoryEntry({ id: "old-entry", amount: 800, startDate: "2025-05-01", createdAt: "2025-05-01" }),
        ],
      };

      const newEntry = createMockAmountHistoryEntry({ id: "new-entry", startDate: "2025-06-01", createdAt: "2025-06-01" });

      const updated = addHistoryEntryToItem(item, newEntry);
      expect(updated.amountHistory).toHaveLength(2);
      expect(updated.amountHistory![0].endDate).toContain("2025-05-31");
    });
  });

  describe("updateHistoryEntry", () => {
    const history = [
      createMockAmountHistoryEntry({
        id: "entry-1",
        amount: 500,
        startDate: "2025-05-01",
        endDate: "2025-05-31",
        verificationStatus: "Needs VR",
        createdAt: "2025-05-01T00:00:00.000Z",
      }),
      createMockAmountHistoryEntry({
        id: "entry-2",
        startDate: "2025-06-01",
        verificationStatus: "Verified",
        createdAt: "2025-06-01T00:00:00.000Z",
      }),
    ];

    it("updates the amount of a matching entry", () => {
      const updated = updateHistoryEntry(history, "entry-2", { amount: 1500 });
      expect(updated).toHaveLength(2);
      expect(updated[1].amount).toBe(1500);
      // Other fields unchanged
      expect(updated[1].startDate).toBe("2025-06-01");
      expect(updated[1].verificationStatus).toBe("Verified");
    });

    it("preserves the entry id and createdAt", () => {
      const updated = updateHistoryEntry(history, "entry-1", {
        amount: 750,
        verificationStatus: "Verified",
      });
      expect(updated[0].id).toBe("entry-1");
      expect(updated[0].createdAt).toBe("2025-05-01T00:00:00.000Z");
      expect(updated[0].amount).toBe(750);
      expect(updated[0].verificationStatus).toBe("Verified");
    });

    it("returns the original array if entryId not found", () => {
      const updated = updateHistoryEntry(history, "nonexistent", { amount: 999 });
      expect(updated).toBe(history);
    });

    it("does not mutate the original array", () => {
      const updated = updateHistoryEntry(history, "entry-1", { amount: 999 });
      expect(history[0].amount).toBe(500);
      expect(updated[0].amount).toBe(999);
    });
  });

  describe("deleteHistoryEntry", () => {
    const history = [
      createMockAmountHistoryEntry({
        id: "entry-1",
        amount: 500,
        startDate: "2025-05-01",
        endDate: "2025-05-31",
        createdAt: "2025-05-01T00:00:00.000Z",
      }),
      createMockAmountHistoryEntry({
        id: "entry-2",
        startDate: "2025-06-01",
        createdAt: "2025-06-01T00:00:00.000Z",
      }),
    ];

    it("removes the entry with matching id", () => {
      const updated = deleteHistoryEntry(history, "entry-1");
      expect(updated).toHaveLength(1);
      expect(updated[0].id).toBe("entry-2");
    });

    it("returns all entries when id not found", () => {
      const updated = deleteHistoryEntry(history, "nonexistent");
      expect(updated).toHaveLength(2);
    });

    it("does not mutate the original array", () => {
      const updated = deleteHistoryEntry(history, "entry-1");
      expect(history).toHaveLength(2);
      expect(updated).toHaveLength(1);
    });

    it("returns empty array when deleting the only entry", () => {
      const single = [
        createMockAmountHistoryEntry({
          id: "only",
          amount: 100,
          startDate: "2025-01-01",
          createdAt: "2025-01-01T00:00:00.000Z",
        }),
      ];
      const updated = deleteHistoryEntry(single, "only");
      expect(updated).toHaveLength(0);
    });
  });

  describe("formatHistoryDate", () => {
    it("returns 'Ongoing' for null/undefined", () => {
      expect(formatHistoryDate(null)).toBe("Ongoing");
      expect(formatHistoryDate(undefined)).toBe("Ongoing");
    });

    it("formats valid date string", () => {
      const formatted = formatHistoryDate("2025-06-15");
      expect(formatted).toContain("Jun");
      expect(formatted).toContain("15");
      expect(formatted).toContain("2025");
    });

    it("returns original string for invalid date", () => {
      expect(formatHistoryDate("not-a-date")).toBe("not-a-date");
    });
  });

  describe("formatMonthYear", () => {
    it("formats date as 'Month YYYY'", () => {
      const date = localDate(2025, 6, 15);
      const formatted = formatMonthYear(date);
      expect(formatted).toContain("June");
      expect(formatted).toContain("2025");
    });
  });
});
