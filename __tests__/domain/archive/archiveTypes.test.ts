/**
 * @fileoverview Tests for archive types and utilities
 */

import { describe, it, expect } from "vitest";
import {
  ARCHIVE_VERSION,
  isCaseArchiveData,
  buildArchiveFileName,
  parseArchiveYear,
  DEFAULT_ARCHIVAL_SETTINGS,
} from "@/types/archive";
import type { CaseArchiveData } from "@/types/archive";

describe("ARCHIVE_VERSION", () => {
  it("should be version 1.0", () => {
    expect(ARCHIVE_VERSION).toBe("1.0");
  });
});

describe("DEFAULT_ARCHIVAL_SETTINGS", () => {
  it("should have 12 months threshold", () => {
    expect(DEFAULT_ARCHIVAL_SETTINGS.thresholdMonths).toBe(12);
  });

  it("should archive closed only by default", () => {
    expect(DEFAULT_ARCHIVAL_SETTINGS.archiveClosedOnly).toBe(true);
  });

  it("should be frozen", () => {
    expect(Object.isFrozen(DEFAULT_ARCHIVAL_SETTINGS)).toBe(true);
  });
});

describe("buildArchiveFileName", () => {
  it("should build correct filename for year", () => {
    expect(buildArchiveFileName(2025)).toBe("archived-cases-2025.json");
    expect(buildArchiveFileName(2026)).toBe("archived-cases-2026.json");
  });
});

describe("parseArchiveYear", () => {
  it("should parse year from valid archive filename", () => {
    expect(parseArchiveYear("archived-cases-2025.json")).toBe(2025);
    expect(parseArchiveYear("archived-cases-2026.json")).toBe(2026);
  });

  it("should return null for invalid filenames", () => {
    expect(parseArchiveYear("cases.json")).toBeNull();
    expect(parseArchiveYear("archived-cases.json")).toBeNull();
    expect(parseArchiveYear("archived-cases-abc.json")).toBeNull();
    expect(parseArchiveYear("archived-cases-2025.txt")).toBeNull();
  });
});

describe("isCaseArchiveData", () => {
  it("should return true for valid archive data", () => {
    const validArchive: CaseArchiveData = {
      version: "1.0",
      archiveType: "cases",
      archivedAt: new Date().toISOString(),
      archiveYear: 2025,
      cases: [],
      financials: [],
      notes: [],
    };

    expect(isCaseArchiveData(validArchive)).toBe(true);
  });

  it("should return false for null", () => {
    expect(isCaseArchiveData(null)).toBe(false);
  });

  it("should return false for non-object", () => {
    expect(isCaseArchiveData("string")).toBe(false);
    expect(isCaseArchiveData(123)).toBe(false);
    expect(isCaseArchiveData(undefined)).toBe(false);
  });

  it("should return false for wrong version", () => {
    const wrongVersion = {
      version: "2.0",
      archiveType: "cases",
      archivedAt: new Date().toISOString(),
      archiveYear: 2025,
      cases: [],
      financials: [],
      notes: [],
    };

    expect(isCaseArchiveData(wrongVersion)).toBe(false);
  });

  it("should return false for wrong archiveType", () => {
    const wrongType = {
      version: "1.0",
      archiveType: "other",
      archivedAt: new Date().toISOString(),
      archiveYear: 2025,
      cases: [],
      financials: [],
      notes: [],
    };

    expect(isCaseArchiveData(wrongType)).toBe(false);
  });

  it("should return false for missing required fields", () => {
    const missingCases = {
      version: "1.0",
      archiveType: "cases",
      archivedAt: new Date().toISOString(),
      archiveYear: 2025,
      financials: [],
      notes: [],
    };

    expect(isCaseArchiveData(missingCases)).toBe(false);
  });

  it("should return false for non-array cases", () => {
    const nonArrayCases = {
      version: "1.0",
      archiveType: "cases",
      archivedAt: new Date().toISOString(),
      archiveYear: 2025,
      cases: "not-an-array",
      financials: [],
      notes: [],
    };

    expect(isCaseArchiveData(nonArrayCases)).toBe(false);
  });
});
