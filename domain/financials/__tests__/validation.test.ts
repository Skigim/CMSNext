import { describe, it, expect } from "vitest";
import {
  validateFinancialItem,
  type FinancialItemInput,
} from "../validation";

describe("validateFinancialItem", () => {
  const validData: FinancialItemInput = {
    description: "Savings Account",
    amount: 1000,
    verificationStatus: "Needs VR",
    verificationSource: "",
  };

  describe("valid inputs", () => {
    it("returns valid for complete data", () => {
      const result = validateFinancialItem(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it("returns valid for zero amount", () => {
      const result = validateFinancialItem({
        ...validData,
        amount: 0,
      });

      expect(result.isValid).toBe(true);
    });

    it("returns valid when verified with source", () => {
      const result = validateFinancialItem({
        ...validData,
        verificationStatus: "Verified",
        verificationSource: "Bank Statement",
      });

      expect(result.isValid).toBe(true);
    });

    it("returns valid for non-verified status without source", () => {
      const result = validateFinancialItem({
        ...validData,
        verificationStatus: "VR Pending",
        verificationSource: "",
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe("description validation", () => {
    it("rejects empty description", () => {
      const result = validateFinancialItem({
        ...validData,
        description: "",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.description).toBe("Description is required");
    });

    it("rejects whitespace-only description", () => {
      const result = validateFinancialItem({
        ...validData,
        description: "   ",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.description).toBe("Description is required");
    });

    it("accepts description with leading/trailing whitespace", () => {
      const result = validateFinancialItem({
        ...validData,
        description: "  Valid Description  ",
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe("amount validation", () => {
    it("rejects negative amount", () => {
      const result = validateFinancialItem({
        ...validData,
        amount: -100,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.amount).toBe("Amount cannot be negative");
    });

    it("rejects small negative amount", () => {
      const result = validateFinancialItem({
        ...validData,
        amount: -0.01,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.amount).toBe("Amount cannot be negative");
    });

    it("accepts large amounts", () => {
      const result = validateFinancialItem({
        ...validData,
        amount: 999999999.99,
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe("verification source validation", () => {
    it("requires source when status is Verified", () => {
      const result = validateFinancialItem({
        ...validData,
        verificationStatus: "Verified",
        verificationSource: "",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.verificationSource).toBe(
        "Verification source is required when status is Verified"
      );
    });

    it("rejects whitespace-only source when Verified", () => {
      const result = validateFinancialItem({
        ...validData,
        verificationStatus: "Verified",
        verificationSource: "   ",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.verificationSource).toBe(
        "Verification source is required when status is Verified"
      );
    });

    it("does not require source for other statuses", () => {
      const statuses = ["Needs VR", "VR Pending", "AVS Pending"];

      for (const status of statuses) {
        const result = validateFinancialItem({
          ...validData,
          verificationStatus: status,
          verificationSource: "",
        });

        expect(result.isValid).toBe(true);
        expect(result.errors.verificationSource).toBeUndefined();
      }
    });
  });

  describe("multiple errors", () => {
    it("returns all errors when multiple fields invalid", () => {
      const result = validateFinancialItem({
        description: "",
        amount: -50,
        verificationStatus: "Verified",
        verificationSource: "",
      });

      expect(result.isValid).toBe(false);
      expect(Object.keys(result.errors)).toHaveLength(3);
      expect(result.errors.description).toBeDefined();
      expect(result.errors.amount).toBeDefined();
      expect(result.errors.verificationSource).toBeDefined();
    });
  });
});
