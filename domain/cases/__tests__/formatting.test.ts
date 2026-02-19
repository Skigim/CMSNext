import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatRetroMonths,
  calculateAge,
  formatVoterStatus,
  calculateAVSTrackingDates,
  extractKnownInstitutions,
} from "../formatting";
import type { FinancialItem } from "@/types/case";

const localDate = (year: number, month: number, day: number): Date =>
  new Date(year, month - 1, day);

describe("formatRetroMonths", () => {
  describe("empty/undefined handling", () => {
    it("returns 'No' for undefined retroMonths", () => {
      expect(formatRetroMonths(undefined, "2024-06-15")).toBe("No");
    });

    it("returns 'No' for empty array", () => {
      expect(formatRetroMonths([], "2024-06-15")).toBe("No");
    });
  });

  describe("single month", () => {
    it("formats single month with year", () => {
      expect(formatRetroMonths(["Mar"], "2024-06-15")).toBe("Yes (Mar 2024)");
    });
  });

  describe("multiple months", () => {
    it("formats range of consecutive months", () => {
      expect(formatRetroMonths(["Jan", "Feb", "Mar"], "2024-06-15")).toBe(
        "Yes (Jan-Mar 2024)"
      );
    });

    it("sorts months in calendar order", () => {
      expect(formatRetroMonths(["Mar", "Jan", "Feb"], "2024-06-15")).toBe(
        "Yes (Jan-Mar 2024)"
      );
    });

    it("formats non-consecutive months as range", () => {
      expect(formatRetroMonths(["Jan", "Mar"], "2024-06-15")).toBe(
        "Yes (Jan-Mar 2024)"
      );
    });
  });

  describe("year inference", () => {
    it("uses year from application date", () => {
      expect(formatRetroMonths(["Jan", "Feb"], "2025-03-15")).toBe(
        "Yes (Jan-Feb 2025)"
      );
    });

    it("uses current year when application date missing", () => {
      const currentYear = new Date().getFullYear();
      expect(formatRetroMonths(["Jan", "Feb"], undefined)).toBe(
        `Yes (Jan-Feb ${currentYear})`
      );
    });

    it("uses current year for invalid application date", () => {
      const currentYear = new Date().getFullYear();
      expect(formatRetroMonths(["Jan", "Feb"], "invalid-date")).toBe(
        `Yes (Jan-Feb ${currentYear})`
      );
    });
  });
});

describe("calculateAge", () => {
  beforeEach(() => {
    // Mock current date to January 2, 2026
    vi.useFakeTimers();
    vi.setSystemTime(localDate(2026, 1, 2));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates age correctly", () => {
    expect(calculateAge("1950-01-15")).toBe(75);
  });

  it("accounts for birthday not yet occurred", () => {
    // DOB is Jan 15, current date is Jan 2 - birthday hasn't happened yet
    expect(calculateAge("1950-01-15")).toBe(75);
  });

  it("accounts for birthday already occurred", () => {
    // DOB is Dec 15, current date is Jan 2 - birthday happened last month
    expect(calculateAge("1950-12-15")).toBe(75);
  });

  it("returns null for undefined", () => {
    expect(calculateAge(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(calculateAge("")).toBeNull();
  });

  it("returns null for invalid date", () => {
    expect(calculateAge("not-a-date")).toBeNull();
  });
});

describe("formatVoterStatus", () => {
  it("formats 'requested' as 'Requested'", () => {
    expect(formatVoterStatus("requested")).toBe("Requested");
  });

  it("formats 'declined' as 'Declined'", () => {
    expect(formatVoterStatus("declined")).toBe("Declined");
  });

  it("formats 'not_answered' as 'Not Answered'", () => {
    expect(formatVoterStatus("not_answered")).toBe("Not Answered");
  });

  it("formats empty string as 'Not Answered'", () => {
    expect(formatVoterStatus("")).toBe("Not Answered");
  });

  it("formats undefined as 'Not Answered'", () => {
    expect(formatVoterStatus(undefined)).toBe("Not Answered");
  });
});

describe("calculateAVSTrackingDates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(localDate(2026, 1, 2));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates all dates correctly", () => {
    const result = calculateAVSTrackingDates("2025-12-29");

    expect(result.consentDate).toBe("12/29/2025");
    expect(result.submitDate).toBe("01/02/2026");
    expect(result.fiveDayDate).toBe("01/07/2026");
    expect(result.elevenDayDate).toBe("01/13/2026");
  });

  it("uses placeholder for missing consent date", () => {
    const result = calculateAVSTrackingDates(undefined);

    expect(result.consentDate).toBe("MM/DD/YYYY");
    expect(result.submitDate).toBe("01/02/2026");
  });

  it("uses placeholder for invalid consent date", () => {
    const result = calculateAVSTrackingDates("invalid-date");

    expect(result.consentDate).toBe("MM/DD/YYYY");
  });

  it("uses provided submit date", () => {
    const customSubmitDate = localDate(2026, 1, 10);
    const result = calculateAVSTrackingDates("2025-12-29", customSubmitDate);

    expect(result.submitDate).toBe("01/10/2026");
    expect(result.fiveDayDate).toBe("01/15/2026");
    expect(result.elevenDayDate).toBe("01/21/2026");
  });

  it("uses provided submit date string", () => {
    const result = calculateAVSTrackingDates("2025-12-29", "2026-01-10");

    expect(result.submitDate).toBe("01/10/2026");
    expect(result.fiveDayDate).toBe("01/15/2026");
    expect(result.elevenDayDate).toBe("01/21/2026");
  });
});

describe("extractKnownInstitutions", () => {
  const createResource = (
    description: string,
    location: string
  ): FinancialItem => ({
    id: crypto.randomUUID(),
    description,
    location,
    amount: 1000,
    verificationStatus: "Verified",
  });

  describe("bank account detection", () => {
    it("extracts institutions from checking accounts", () => {
      const resources = [createResource("Checking Account", "First National Bank")];
      expect(extractKnownInstitutions(resources)).toBe("First National Bank");
    });

    it("extracts institutions from savings accounts", () => {
      const resources = [createResource("Savings", "Credit Union")];
      expect(extractKnownInstitutions(resources)).toBe("Credit Union");
    });

    it("extracts institutions from CD accounts", () => {
      const resources = [createResource("CD", "Local Bank")];
      expect(extractKnownInstitutions(resources)).toBe("Local Bank");
    });

    it("extracts institutions from money market accounts", () => {
      const resources = [createResource("Money Market", "Investment Bank")];
      expect(extractKnownInstitutions(resources)).toBe("Investment Bank");
    });

    it("extracts institutions from IRA accounts", () => {
      const resources = [createResource("IRA", "Fidelity")];
      expect(extractKnownInstitutions(resources)).toBe("Fidelity");
    });

    it("extracts institutions from 401k accounts", () => {
      const resources = [createResource("401k", "Vanguard")];
      expect(extractKnownInstitutions(resources)).toBe("Vanguard");
    });

    it("is case-insensitive", () => {
      const resources = [createResource("CHECKING ACCOUNT", "Bank A")];
      expect(extractKnownInstitutions(resources)).toBe("Bank A");
    });
  });

  describe("filtering non-bank items", () => {
    it("excludes vehicles", () => {
      const resources = [
        createResource("Checking Account", "Bank A"),
        createResource("Vehicle", "Toyota Dealer"),
      ];
      expect(extractKnownInstitutions(resources)).toBe("Bank A");
    });

    it("excludes life insurance", () => {
      const resources = [
        createResource("Checking Account", "Bank A"),
        createResource("Life Insurance", "MetLife"),
      ];
      expect(extractKnownInstitutions(resources)).toBe("Bank A");
    });

    it("excludes property", () => {
      const resources = [
        createResource("Checking Account", "Bank A"),
        createResource("Real Estate", "123 Main St"),
      ];
      expect(extractKnownInstitutions(resources)).toBe("Bank A");
    });
  });

  describe("deduplication", () => {
    it("deduplicates same institution", () => {
      const resources = [
        createResource("Checking Account", "First National Bank"),
        createResource("Savings Account", "First National Bank"),
      ];
      expect(extractKnownInstitutions(resources)).toBe("First National Bank");
    });
  });

  describe("multiple institutions", () => {
    it("joins multiple institutions with comma", () => {
      const resources = [
        createResource("Checking Account", "First National Bank"),
        createResource("Savings", "Credit Union"),
      ];
      const result = extractKnownInstitutions(resources);
      expect(result).toContain("First National Bank");
      expect(result).toContain("Credit Union");
      expect(result).toContain(", ");
    });
  });

  describe("empty/no matches", () => {
    it("returns 'None Attested' for undefined", () => {
      expect(extractKnownInstitutions(undefined)).toBe("None Attested");
    });

    it("returns 'None Attested' for empty array", () => {
      expect(extractKnownInstitutions([])).toBe("None Attested");
    });

    it("returns 'None Attested' when no bank accounts", () => {
      const resources = [
        createResource("Vehicle", "Toyota Dealer"),
        createResource("Life Insurance", "MetLife"),
      ];
      expect(extractKnownInstitutions(resources)).toBe("None Attested");
    });

    it("returns 'None Attested' when bank account has no location", () => {
      const resources = [{ ...createResource("Checking Account", ""), location: undefined }];
      expect(extractKnownInstitutions(resources as FinancialItem[])).toBe("None Attested");
    });
  });
});
