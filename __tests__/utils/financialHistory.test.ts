import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getFirstOfMonth,
  getLastOfMonth,
  isDateInEntryRange,
  getAmountForMonth,
  getEntryForMonth,
  sortHistoryEntries,
  createHistoryEntry,
  closePreviousOngoingEntry,
  addHistoryEntryToItem,
  formatHistoryDate,
  formatMonthYear,
} from "@/utils/financialHistory";
import type { AmountHistoryEntry, FinancialItem } from "@/types/case";

// Mock uuid for consistent IDs in tests
vi.mock("uuid", () => ({
  v4: () => "test-uuid-1234",
}));

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
    const entry: AmountHistoryEntry = {
      id: "1",
      amount: 1000,
      startDate: "2025-06-01T00:00:00.000Z",
      endDate: "2025-06-30T23:59:59.999Z",
      createdAt: "2025-06-01T00:00:00.000Z",
    };

    it("returns true for date within range", () => {
      const targetDate = new Date("2025-06-15");
      expect(isDateInEntryRange(entry, targetDate)).toBe(true);
    });

    it("returns true for date on start boundary", () => {
      const targetDate = new Date("2025-06-01");
      expect(isDateInEntryRange(entry, targetDate)).toBe(true);
    });

    it("returns true for date on end boundary", () => {
      const targetDate = new Date("2025-06-30");
      expect(isDateInEntryRange(entry, targetDate)).toBe(true);
    });

    it("returns false for date before range", () => {
      const targetDate = new Date("2025-05-31");
      expect(isDateInEntryRange(entry, targetDate)).toBe(false);
    });

    it("returns false for date after range", () => {
      const targetDate = new Date("2025-07-01");
      expect(isDateInEntryRange(entry, targetDate)).toBe(false);
    });

    it("returns true for ongoing entry (no endDate) if date >= startDate", () => {
      const ongoingEntry: AmountHistoryEntry = {
        id: "2",
        amount: 2000,
        startDate: "2025-06-01T00:00:00.000Z",
        endDate: null,
        createdAt: "2025-06-01T00:00:00.000Z",
      };
      expect(isDateInEntryRange(ongoingEntry, new Date("2025-12-15"))).toBe(true);
    });
  });

  describe("getAmountForMonth", () => {
    const baseItem: FinancialItem = {
      id: "item-1",
      description: "Test Item",
      amount: 500, // fallback amount
      verificationStatus: "Verified",
    };

    it("returns item.amount when no amountHistory exists", () => {
      expect(getAmountForMonth(baseItem, new Date("2025-06-15"))).toBe(500);
    });

    it("returns item.amount when amountHistory is empty", () => {
      const itemWithEmptyHistory = { ...baseItem, amountHistory: [] };
      expect(getAmountForMonth(itemWithEmptyHistory, new Date("2025-06-15"))).toBe(500);
    });

    it("returns matching entry amount when history exists", () => {
      const itemWithHistory: FinancialItem = {
        ...baseItem,
        amountHistory: [
          {
            id: "1",
            amount: 1000,
            startDate: "2025-06-01T00:00:00.000Z",
            endDate: null,
            createdAt: "2025-06-01T00:00:00.000Z",
          },
        ],
      };
      expect(getAmountForMonth(itemWithHistory, new Date("2025-06-15"))).toBe(1000);
    });

    it("returns most recent applicable entry for multiple entries", () => {
      const itemWithMultipleHistory: FinancialItem = {
        ...baseItem,
        amountHistory: [
          {
            id: "1",
            amount: 1000,
            startDate: "2025-05-01T00:00:00.000Z",
            endDate: "2025-05-31T00:00:00.000Z",
            createdAt: "2025-05-01T00:00:00.000Z",
          },
          {
            id: "2",
            amount: 1500,
            startDate: "2025-06-01T00:00:00.000Z",
            endDate: null,
            createdAt: "2025-06-01T00:00:00.000Z",
          },
        ],
      };
      expect(getAmountForMonth(itemWithMultipleHistory, new Date("2025-06-15"))).toBe(1500);
      expect(getAmountForMonth(itemWithMultipleHistory, new Date("2025-05-15"))).toBe(1000);
    });

    it("falls back to item.amount when no entry covers the date", () => {
      const itemWithHistory: FinancialItem = {
        ...baseItem,
        amountHistory: [
          {
            id: "1",
            amount: 1000,
            startDate: "2025-06-01T00:00:00.000Z",
            endDate: "2025-06-30T00:00:00.000Z",
            createdAt: "2025-06-01T00:00:00.000Z",
          },
        ],
      };
      // Requesting amount for July when only June is covered
      expect(getAmountForMonth(itemWithHistory, new Date("2025-07-15"))).toBe(500);
    });
  });

  describe("getEntryForMonth", () => {
    const baseItem: FinancialItem = {
      id: "item-1",
      description: "Test Item",
      amount: 500,
      verificationStatus: "Verified",
    };

    it("returns undefined when no amountHistory exists", () => {
      expect(getEntryForMonth(baseItem, new Date("2025-06-15"))).toBeUndefined();
    });

    it("returns the matching entry", () => {
      const entry: AmountHistoryEntry = {
        id: "1",
        amount: 1000,
        startDate: "2025-06-01T00:00:00.000Z",
        endDate: null,
        createdAt: "2025-06-01T00:00:00.000Z",
      };
      const itemWithHistory = { ...baseItem, amountHistory: [entry] };
      expect(getEntryForMonth(itemWithHistory, new Date("2025-06-15"))).toEqual(entry);
    });
  });

  describe("sortHistoryEntries", () => {
    it("sorts entries by startDate in descending order (most recent first)", () => {
      const entries: AmountHistoryEntry[] = [
        { id: "1", amount: 100, startDate: "2025-04-01T00:00:00.000Z", createdAt: "" },
        { id: "2", amount: 200, startDate: "2025-06-01T00:00:00.000Z", createdAt: "" },
        { id: "3", amount: 300, startDate: "2025-05-01T00:00:00.000Z", createdAt: "" },
      ];

      const sorted = sortHistoryEntries(entries);
      expect(sorted[0].id).toBe("2"); // June
      expect(sorted[1].id).toBe("3"); // May
      expect(sorted[2].id).toBe("1"); // April
    });

    it("does not mutate the original array", () => {
      const entries: AmountHistoryEntry[] = [
        { id: "1", amount: 100, startDate: "2025-04-01T00:00:00.000Z", createdAt: "" },
        { id: "2", amount: 200, startDate: "2025-06-01T00:00:00.000Z", createdAt: "" },
      ];

      const sorted = sortHistoryEntries(entries);
      expect(entries[0].id).toBe("1"); // Original unchanged
      expect(sorted[0].id).toBe("2");
    });
  });

  describe("createHistoryEntry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-15T12:00:00.000Z"));
    });

    it("creates entry with provided amount and default startDate", () => {
      const entry = createHistoryEntry(1500);
      expect(entry.amount).toBe(1500);
      expect(entry.startDate).toContain("2025-06-01");
      expect(entry.endDate).toBeNull();
      expect(entry.id).toBe("test-uuid-1234");
    });

    it("uses provided startDate", () => {
      const entry = createHistoryEntry(1500, "2025-05-01T00:00:00.000Z");
      expect(entry.startDate).toBe("2025-05-01T00:00:00.000Z");
    });

    it("includes optional endDate and verificationSource", () => {
      const entry = createHistoryEntry(1500, undefined, {
        endDate: "2025-06-30T00:00:00.000Z",
        verificationSource: "Bank Statement",
      });
      expect(entry.endDate).toBe("2025-06-30T00:00:00.000Z");
      expect(entry.verificationSource).toBe("Bank Statement");
    });
  });

  describe("closePreviousOngoingEntry", () => {
    it("closes ongoing entries that start before new entry", () => {
      const history: AmountHistoryEntry[] = [
        {
          id: "1",
          amount: 1000,
          startDate: "2025-05-01T00:00:00.000Z",
          endDate: null,
          createdAt: "2025-05-01T00:00:00.000Z",
        },
      ];

      const updated = closePreviousOngoingEntry(history, "2025-06-01T00:00:00.000Z");
      expect(updated[0].endDate).toContain("2025-05-31");
    });

    it("does not modify entries that already have endDate", () => {
      const history: AmountHistoryEntry[] = [
        {
          id: "1",
          amount: 1000,
          startDate: "2025-05-01T00:00:00.000Z",
          endDate: "2025-05-15T00:00:00.000Z",
          createdAt: "2025-05-01T00:00:00.000Z",
        },
      ];

      const updated = closePreviousOngoingEntry(history, "2025-06-01T00:00:00.000Z");
      expect(updated[0].endDate).toBe("2025-05-15T00:00:00.000Z");
    });

    it("returns empty array for empty input", () => {
      expect(closePreviousOngoingEntry([], "2025-06-01T00:00:00.000Z")).toEqual([]);
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

      const newEntry: AmountHistoryEntry = {
        id: "entry-1",
        amount: 1000,
        startDate: "2025-06-01T00:00:00.000Z",
        endDate: null,
        createdAt: "2025-06-01T00:00:00.000Z",
      };

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
          {
            id: "old-entry",
            amount: 800,
            startDate: "2025-05-01T00:00:00.000Z",
            endDate: null,
            createdAt: "2025-05-01T00:00:00.000Z",
          },
        ],
      };

      const newEntry: AmountHistoryEntry = {
        id: "new-entry",
        amount: 1000,
        startDate: "2025-06-01T00:00:00.000Z",
        endDate: null,
        createdAt: "2025-06-01T00:00:00.000Z",
      };

      const updated = addHistoryEntryToItem(item, newEntry);
      expect(updated.amountHistory).toHaveLength(2);
      expect(updated.amountHistory![0].endDate).toContain("2025-05-31");
    });
  });

  describe("formatHistoryDate", () => {
    it("returns 'Ongoing' for null/undefined", () => {
      expect(formatHistoryDate(null)).toBe("Ongoing");
      expect(formatHistoryDate(undefined)).toBe("Ongoing");
    });

    it("formats valid ISO date", () => {
      const formatted = formatHistoryDate("2025-06-15T00:00:00.000Z");
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
      const date = new Date("2025-06-15");
      const formatted = formatMonthYear(date);
      expect(formatted).toContain("June");
      expect(formatted).toContain("2025");
    });
  });
});
