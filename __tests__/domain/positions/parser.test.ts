/**
 * @fileoverview Tests for Position Assignments Parser
 *
 * Tests the parsing of N-FOCUS "List Position Assignments" XML exports.
 */

import { describe, it, expect } from "vitest";
import {
  parseCrystalReportXML,
  parsePositionAssignments,
} from "@/domain/positions/parser";

// ============================================================================
// Test Data
// ============================================================================

/**
 * Build a single XML section matching the Crystal Reports export format.
 */
function buildSection(mcn: string, name: string): string {
  return `
    <Section>
      <Field Name="Mst Case"><FormattedValue>${mcn}</FormattedValue></Field>
      <Field Name="Program"><FormattedValue>MEDICAID</FormattedValue></Field>
      <Field Name="Program Case Name"><FormattedValue>${name}</FormattedValue></Field>
      <Field Name="St"><FormattedValue>PE</FormattedValue></Field>
      <Field Name="Status Dt"><FormattedValue>01-01-2026</FormattedValue></Field>
      <Field Name="Rev/Recrt"><FormattedValue>01-02-2026</FormattedValue></Field>
      <Field Name="Appl Rcvd"><FormattedValue>01-09-2026</FormattedValue></Field>
      <Field Name="Days Pndg"><FormattedValue>39</FormattedValue></Field>
      <Field Name="Exp"><FormattedValue></FormattedValue></Field>
      <Field Name="Assistance"><FormattedValue>Non-MAGI</FormattedValue></Field>
      <Field Name="Language"><FormattedValue>EN</FormattedValue></Field>
      <Field Name="Wrkr Role"><FormattedValue>PW</FormattedValue></Field>
      <Field Name="Assign Beg. Dt"><FormattedValue>01-09-2026</FormattedValue></Field>
    </Section>
  `;
}

function buildXml(sections: string[]): string {
  return `<Report><Details>${sections.join("")}</Details></Report>`;
}

// ============================================================================
// Tests
// ============================================================================

describe("parsePositionAssignments", () => {
  describe("basic parsing", () => {
    it("should parse a single valid section", () => {
      const xml = buildXml([buildSection("123456", "SMITH, JOHN A")]);
      const result = parsePositionAssignments(xml);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({
        mcn: "123456",
        name: "SMITH, JOHN A",
      });
      expect(result.skippedRows).toBe(0);
      expect(result.duplicatesRemoved).toBe(0);
    });

    it("should parse multiple sections", () => {
      const xml = buildXml([
        buildSection("100001", "DOE, JANE M"),
        buildSection("100002", "JONES, BOB"),
        buildSection("100003", "WILLIAMS, ANN R"),
      ]);
      const result = parsePositionAssignments(xml);

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0].mcn).toBe("100001");
      expect(result.entries[1].mcn).toBe("100002");
      expect(result.entries[2].mcn).toBe("100003");
    });

    it("should extract names correctly", () => {
      const xml = buildXml([buildSection("999999", "LASTNAME, FIRSTNAME MI")]);
      const result = parsePositionAssignments(xml);

      expect(result.entries[0].name).toBe("LASTNAME, FIRSTNAME MI");
    });
  });

  describe("deduplication", () => {
    it("should deduplicate by MCN (first occurrence wins)", () => {
      const xml = buildXml([
        buildSection("123456", "SMITH, JOHN"),
        buildSection("123456", "SMITH, JOHN A"),
        buildSection("789012", "DOE, JANE"),
      ]);
      const result = parsePositionAssignments(xml);

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual({ mcn: "123456", name: "SMITH, JOHN" });
      expect(result.entries[1]).toEqual({ mcn: "789012", name: "DOE, JANE" });
      expect(result.duplicatesRemoved).toBe(1);
    });
  });

  describe("statistics", () => {
    it("should report correct totalRows", () => {
      const xml = buildXml([
        buildSection("100001", "DOE, JANE"),
        buildSection("100002", "SMITH, BOB"),
      ]);
      const result = parsePositionAssignments(xml);

      expect(result.totalRows).toBe(2);
    });

    it("should report skippedRows for invalid rows", () => {
      const xml = buildXml([
        buildSection("100001", "DOE, JANE"),
        "<Section><Field Name=\"Program\"><FormattedValue>MEDICAID</FormattedValue></Field></Section>",
        buildSection("100002", "SMITH, BOB"),
      ]);
      const result = parsePositionAssignments(xml);

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
      const xml = buildXml([buildSection("ABC", "SMITH, JOHN")]);
      const result = parsePositionAssignments(xml);

      expect(result.entries).toHaveLength(0);
      expect(result.skippedRows).toBe(1);
    });

    it("should skip rows without the Mst Case sentinel", () => {
      const xml = "<Report><Details><Section><Field Name=\"Program\"><FormattedValue>MEDICAID</FormattedValue></Field></Section></Details></Report>";
      const result = parsePositionAssignments(xml);

      expect(result.entries).toHaveLength(0);
      expect(result.skippedRows).toBe(1);
    });

    it("should set name to Unknown when name field is empty", () => {
      const xml = buildXml([buildSection("111111", "")]);
      const result = parsePositionAssignments(xml);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].name).toBe("Unknown");
    });

    it("should handle large MCN numbers", () => {
      const xml = buildXml([buildSection("9999999999", "BIG, NUMBER")]);
      const result = parsePositionAssignments(xml);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].mcn).toBe("9999999999");
    });
  });

  describe("real-world format", () => {
    it("should map Crystal Reports fields to CaseRecord shape", () => {
      const xml = buildXml([buildSection("123456", "LASTNAME, FIRSTNAME MI")]);
      const records = parseCrystalReportXML(xml);

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        masterCaseId: "123456",
        caseName: "LASTNAME, FIRSTNAME MI",
      });
    });

    it("should parse namespaced XML tags", () => {
      const xml = `
        <cr:Report xmlns:cr="urn:crystal-report">
          <cr:Details>
            <cr:Section>
              <cr:Field Name="Mst Case"><cr:FormattedValue>123456</cr:FormattedValue></cr:Field>
              <cr:Field Name="Program Case Name"><cr:FormattedValue>SMITH, JOHN A</cr:FormattedValue></cr:Field>
            </cr:Section>
          </cr:Details>
        </cr:Report>
      `;

      const result = parsePositionAssignments(xml);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({ mcn: "123456", name: "SMITH, JOHN A" });
    });

    it("should parse field name attribute regardless of case", () => {
      const xml = `
        <Report>
          <Details>
            <Section>
              <Field name="Mst Case"><FormattedValue>456789</FormattedValue></Field>
              <Field name="Program Case Name"><FormattedValue>DOE, JANE</FormattedValue></Field>
            </Section>
          </Details>
        </Report>
      `;

      const result = parsePositionAssignments(xml);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({ mcn: "456789", name: "DOE, JANE" });
    });

    it("should parse MCN when export uses 'Master Case' label", () => {
      const xml = `
        <Report>
          <Details>
            <Section>
              <Field Name="Master Case"><FormattedValue>777888</FormattedValue></Field>
              <Field Name="Program Case Name"><FormattedValue>PUBLIC, TEST</FormattedValue></Field>
            </Section>
          </Details>
        </Report>
      `;

      const result = parsePositionAssignments(xml);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({ mcn: "777888", name: "PUBLIC, TEST" });
    });

    it("should parse SF* Name/FieldName variant from production export", () => {
      const xml = `
        <Report>
          <Details Level="1">
            <Section SectionNumber="0">
              <Field Name="SFMasterCaseIdNbr1" FieldName="{Gen_View.SF_Master_Case}">
                <FormattedValue>123456</FormattedValue>
              </Field>
              <Field Name="SFPcNameOrOwner1" FieldName="{Gen_View.SF_Program_Case_Name}">
                <FormattedValue>SMITH, JOHN A</FormattedValue>
              </Field>
              <Field Name="SFApplicationReceivedDateorText1" FieldName="{Gen_View.Application_Received_Date_or_Text}">
                <FormattedValue>01-09-2026</FormattedValue>
              </Field>
              <Field Name="SFStatusCode1" FieldName="{Gen_View.SF_Status}">
                <FormattedValue>PE</FormattedValue>
              </Field>
            </Section>
          </Details>
        </Report>
      `;

      const result = parsePositionAssignments(xml);
      const records = parseCrystalReportXML(xml);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({ mcn: "123456", name: "SMITH, JOHN A" });
      expect(records[0]?.applicationDate).toBe("01-09-2026");
    });

    it("should throw on invalid XML", () => {
      expect(() => parseCrystalReportXML("<Report><Details>")).toThrow("Invalid XML document format.");
    });
  });
});
