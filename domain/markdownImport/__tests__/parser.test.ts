import { describe, expect, it } from "vitest";
import { parseMarkdownCaseImport } from "@/domain/markdownImport";

const strictMarkdownFixture = `
## **Person Info**
| Field | Value |
| --- | --- |
| Applicant Name | Jane Q. Doe |
| First Name | Jane |
| Last Name | Doe |
| DOB | 02/03/1980 |
| Marital Status | Married |
| Phone | (402) 555-0101 |
| Email | jane@example.com |
| SSN | 123-45-6789 |

## Case Info
| Field | Value |
| :--- | :--- |
| Case ID | MCN-123 |
| Waiver Requested | Yes |
| Retro Months Requested | Jan, Feb 2026 |
| Application Date | 03/01/2026 |
| Case Type | Medicaid |

## Contact Info
| Field | Value |
| --- | --- |
| Physical Address | 123 Main St, Apt 4B, Omaha, NE 68102 |
| Mailing Same as Physical | Yes |
| Email for Notices | notices@example.com |

## Household
| Name | Relationship | DOB | Phone | Notes |
| --- | --- | --- | --- | --- |
| John Doe | Spouse | 01/15/1979 | 402-555-0102 | Needs follow-up |

## Benefits
| Field | Value |
| --- | --- |
| Income | $1000 |
`;

describe("parseMarkdownCaseImport", () => {
  it("maps intake-safe fields and reports unsupported sections and fields", () => {
    // ARRANGE & ACT
    const result = parseMarkdownCaseImport(strictMarkdownFixture);

    // ASSERT
    expect(result.initialData).toMatchObject({
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: "1980-02-03",
      maritalStatus: "Married",
      phone: "(402) 555-0101",
      email: "jane@example.com",
      mcn: "MCN-123",
      withWaiver: true,
      retroRequested: "Jan, Feb 2026",
      applicationDate: "2026-03-01",
      address: {
        street: "123 Main St",
        apt: "Apt 4B",
        city: "Omaha",
        state: "NE",
        zip: "68102",
      },
      mailingAddress: {
        sameAsPhysical: true,
      },
    });
    expect(result.initialData.householdMembers).toHaveLength(1);
    expect(result.initialData.householdMembers?.[0]).toMatchObject({
      firstName: "John",
      lastName: "Doe",
      relationshipType: "Spouse",
      dateOfBirth: "1979-01-15",
      phone: "402-555-0102",
    });
    expect(result.unsupportedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "SSN", reason: "SSN is intentionally out of scope for MVP import." }),
        expect.objectContaining({ label: "Case Type" }),
        expect.objectContaining({ section: "Household", label: "notes" }),
      ]),
    );
    expect(result.unsupportedSections).toEqual(["Benefits"]);
    expect(result.hasImportedData).toBe(true);
  });

  it("prefers explicit first and last name over splitting applicant name", () => {
    // ARRANGE
    const input = `
## Person Info
- Applicant Name: Alex Maria Rivera
- First Name: Alexandra
- Last Name: Rivera
## Case Info
- Case ID: MCN-7
- Application Date: 2026-03-20
`;

    // ACT
    const result = parseMarkdownCaseImport(input);

    // ASSERT
    expect(result.initialData.firstName).toBe("Alexandra");
    expect(result.initialData.lastName).toBe("Rivera");
  });

  it("falls back to splitting applicant name when explicit names are missing", () => {
    // ARRANGE
    const input = `
## Person Info
- Applicant Name: Alex Rivera
## Case Info
- Case ID: MCN-8
- Application Date: 2026-03-21
`;

    // ACT
    const result = parseMarkdownCaseImport(input);

    // ASSERT
    expect(result.initialData.firstName).toBe("Alex");
    expect(result.initialData.lastName).toBe("Rivera");
    expect(result.mappedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Applicant Name", target: "firstName/lastName" }),
      ]),
    );
  });

  it("warns when an address cannot be confidently parsed", () => {
    // ARRANGE
    const input = `
## Person Info
- First Name: Casey
- Last Name: Jones
## Case Info
- Case ID: MCN-9
- Application Date: 2026-03-22
## Contact Info
- Physical Address: Omaha address still pending
`;

    // ACT
    const result = parseMarkdownCaseImport(input);

    // ASSERT
    expect(result.initialData.address).toBeUndefined();
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Physical Address could not be confidently parsed"),
      ]),
    );
  });
});
