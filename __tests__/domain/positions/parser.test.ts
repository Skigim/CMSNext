/**
 * @fileoverview Tests for Position Assignments Parser
 *
 * Tests the parsing of N-FOCUS "List Position Assignments" CSV exports.
 */

import { describe, it, expect } from "vitest";
import {
  parsePositionAssignments,
} from "@/domain/positions/parser";

// ============================================================================
// Test Data
// ============================================================================

/**
 * Build a single CSV row matching the N-FOCUS export format.
 * Each row contains header metadata followed by the case data fields.
 */
function buildRow(mcn: string, name: string): string {
  return [
    '"Position: "',
    '"List Position Assignments - Program Case\nTAYLOR HARRIS, GENEVA - ELIGIBILITY OPERATIONS\nView by Master Case"',
    '"61704790"',
    '"Page -1 of 1"',
    '"Sort:"',
    '"None"',
    '"Filter:"',
    '"None"',
    '"Assignments"',
    '"Mst Case"',        // sentinel — index 9
    '"Program"',         // +1
    '"Program Case Name\n"', // +2
    '"St"',              // +3
    '"Status Dt"',       // +4
    '"Rev/Recrt"',       // +5
    '"Appl Rcvd"',       // +6
    '"Days \nPndg "',    // +7
    '"Exp"',             // +8
    '"Assistance"',      // +9
    '"Language"',        // +10
    '"Wrkr Role"',       // +11
    '"Assign\nBeg. Dt"', // +12
    mcn,                 // +13 = MCN value
    '"MEDICAID"',        // +14
    `"${name}"`,         // +15 = case name value
    '"PE"',
    '01-01-2026',
    '',
    '"01-02-2026"',
    '39',
    '',
    '"Non-MAGI"',
    '',
    '"PW"',
    '01-09-2026',
    '"Total Master Cases:"',
    '"96"',
    '"N-FOCUS: NFO6371L01"',
    '"DEPARTMENT OF HEALTH AND HUMAN SERVICES"',
    '02-10-2026   9:09:15 AM',
  ].join(",");
}

function buildCsv(rows: string[]): string {
  return rows.join("\n");
}

// ============================================================================
// Tests
// ============================================================================

describe("parsePositionAssignments", () => {
  describe("basic parsing", () => {
    it("should parse a single valid row", () => {
      const csv = buildCsv([buildRow("123456", "SMITH, JOHN A")]);
      const result = parsePositionAssignments(csv);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({
        mcn: "123456",
        name: "SMITH, JOHN A",
      });
      expect(result.skippedRows).toBe(0);
      expect(result.duplicatesRemoved).toBe(0);
    });

    it("should parse multiple rows", () => {
      const csv = buildCsv([
        buildRow("100001", "DOE, JANE M"),
        buildRow("100002", "JONES, BOB"),
        buildRow("100003", "WILLIAMS, ANN R"),
      ]);
      const result = parsePositionAssignments(csv);

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0].mcn).toBe("100001");
      expect(result.entries[1].mcn).toBe("100002");
      expect(result.entries[2].mcn).toBe("100003");
    });

    it("should extract names correctly", () => {
      const csv = buildCsv([buildRow("999999", "LASTNAME, FIRSTNAME MI")]);
      const result = parsePositionAssignments(csv);

      expect(result.entries[0].name).toBe("LASTNAME, FIRSTNAME MI");
    });
  });

  describe("deduplication", () => {
    it("should deduplicate by MCN (first occurrence wins)", () => {
      const csv = buildCsv([
        buildRow("123456", "SMITH, JOHN"),
        buildRow("123456", "SMITH, JOHN A"),
        buildRow("789012", "DOE, JANE"),
      ]);
      const result = parsePositionAssignments(csv);

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual({ mcn: "123456", name: "SMITH, JOHN" });
      expect(result.entries[1]).toEqual({ mcn: "789012", name: "DOE, JANE" });
      expect(result.duplicatesRemoved).toBe(1);
    });
  });

  describe("statistics", () => {
    it("should report correct totalRows", () => {
      const csv = buildCsv([
        buildRow("100001", "DOE, JANE"),
        buildRow("100002", "SMITH, BOB"),
      ]);
      const result = parsePositionAssignments(csv);

      expect(result.totalRows).toBe(2);
    });

    it("should report skippedRows for invalid rows", () => {
      const csv = buildCsv([
        buildRow("100001", "DOE, JANE"),
        '"just","some","garbage","data"',
        buildRow("100002", "SMITH, BOB"),
      ]);
      const result = parsePositionAssignments(csv);

      expect(result.entries).toHaveLength(2);
      expect(result.skippedRows).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("should return empty result for empty input", () => {
      const result = parsePositionAssignments("");

      expect(result).toEqual({
        entries: [],
        totalRows: 0,
        skippedRows: 0,
        duplicatesRemoved: 0,
      });
    });

    it("should return empty result for whitespace-only input", () => {
      const result = parsePositionAssignments("   \n\n  ");

      expect(result).toEqual({
        entries: [],
        totalRows: 0,
        skippedRows: 0,
        duplicatesRemoved: 0,
      });
    });

    it("should skip rows without a valid numeric MCN", () => {
      // Non-numeric MCN
      const csv = buildCsv([buildRow('"ABC"', "SMITH, JOHN")]);
      const result = parsePositionAssignments(csv);

      expect(result.entries).toHaveLength(0);
      expect(result.skippedRows).toBe(1);
    });

    it("should skip rows without the Mst Case sentinel", () => {
      const csv = '"No","Mst","Case","sentinel","here"';
      const result = parsePositionAssignments(csv);

      expect(result.entries).toHaveLength(0);
      expect(result.skippedRows).toBe(1);
    });

    it("should set name to Unknown when name field is empty", () => {
      const csv = buildCsv([buildRow("111111", "")]);
      const result = parsePositionAssignments(csv);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].name).toBe("Unknown");
    });

    it("should handle large MCN numbers", () => {
      const csv = buildCsv([buildRow("9999999999", "BIG, NUMBER")]);
      const result = parsePositionAssignments(csv);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].mcn).toBe("9999999999");
    });
  });

  describe("real-world format", () => {
    it("should parse the actual N-FOCUS export format", () => {
      // This mirrors the exact format from the user's sample
      const rawRow = `"Position: ","List Position Assignments - Program Case
TAYLOR HARRIS, GENEVA - ELIGIBILITY OPERATIONS
View by Master Case","61704790","Page -1 of 1","Sort:","None","Filter:","None","Assignments","Mst Case","Program","Program Case Name

","St","Status Dt","Rev/Recrt","Appl Rcvd","Days 

Pndg ","Exp","Assistance","Language","Wrkr Role","Assign

Beg. Dt",123456,"MEDICAID","LASTNAME, FIRSTNAME MI","PE",01-01-2026,,"01-02-2026",39,,"Non-MAGI",,"PW",01-09-2026,"Total Master Cases:","96","N-FOCUS: NFO6371L01","DEPARTMENT OF HEALTH AND HUMAN SERVICES",02-10-2026   9:09:15 AM`;

      const csv = [rawRow, rawRow.replace("123456", "789012")].join("\n");
      const result = parsePositionAssignments(csv);

      expect(result.entries.length).toBeGreaterThanOrEqual(1);
      // At minimum, we should find MCN 123456
      const mcns = result.entries.map((e) => e.mcn);
      expect(mcns).toContain("123456");
    });
  });
});
