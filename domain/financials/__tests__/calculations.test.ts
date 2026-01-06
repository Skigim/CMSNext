import { describe, it, expect } from "vitest";
import { calculateCategoryTotal, calculateFinancialTotals } from "../calculations";
import type { FinancialItem, Financials } from "@/types/case";

describe("domain/financials/calculations", () => {
  describe("calculateCategoryTotal", () => {
    const mockItems: FinancialItem[] = [
      {
        id: "1",
        description: "Standard Item",
        amount: 1000,
        verificationStatus: "Verified",
      },
      {
        id: "2",
        description: "Zero Item",
        amount: 0,
        verificationStatus: "Verified",
      },
      {
        id: "3",
        description: "Historical Item",
        amount: 500, // Current/fallback amount
        verificationStatus: "Verified",
        amountHistory: [
          {
            id: "h1",
            amount: 800,
            startDate: "2025-01-01",
            endDate: "2025-06-01", // Past period
            createdAt: "2025-01-01",
          },
          {
            id: "h2",
            amount: 500,
            startDate: "2025-06-02",
            createdAt: "2025-06-02",
          },
        ],
      },
    ];

    it("returns 0 for empty list", () => {
      expect(calculateCategoryTotal([])).toBe(0);
    });

    it("sums current amounts correctly", () => {
      // Current date (uses 500 from history or item.amount)
      const total = calculateCategoryTotal(mockItems);
      // 1000 + 0 + 500 = 1500
      expect(total).toBe(1500);
    });

    it("sums historical amounts correctly", () => {
      // Past date: Feb 2025 (should use 800 from history)
      const pastDate = new Date("2025-02-15");
      const total = calculateCategoryTotal(mockItems, pastDate);

      // 1000 (no history, uses valid) + 0 + 800 (history) = 1800
      expect(total).toBe(1800);
    });
  });

  describe("calculateFinancialTotals", () => {
    it("calculates totals for all categories", () => {
      const financials: Financials = {
        resources: [{ id: "1", amount: 100, description: "R1", verificationStatus: "Verified" }],
        income: [{ id: "2", amount: 200, description: "I1", verificationStatus: "Verified" }],
        expenses: [{ id: "3", amount: 50, description: "E1", verificationStatus: "Verified" }],
      };

      const result = calculateFinancialTotals(financials);

      expect(result).toEqual({
        resources: 100,
        income: 200,
        expenses: 50,
      });
    });
  });
});
