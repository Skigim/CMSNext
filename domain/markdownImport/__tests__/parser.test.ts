import { describe, expect, it } from "vitest";
import { parseMarkdownCaseImport } from "@/domain/markdownImport";

const strictMarkdownFixture = `
## Person Info
| Applicant Name | First Name | Last Name | DOB | SSN | Marital Status | Phone | Email |
| --- | --- | --- | --- | --- | --- | --- | --- |
| John Doe | John | Doe | 05/14/1982 | - | Single | 555-0198 | j.doe@example.com |

## Case Info
| Case ID | Waiver Requested | Retro Months Requested | Application Date | Notes |
| --- | --- | --- | --- | --- |
| CASE-98765 | Yes | 3 | 10/12/2023 | - |

## Contact Info
| Physical Address | Mailing Same As Physical | Mailing Address | Best Contact Number | Additional Contact Number | Preferred Message Delivery | Email for Notices |
| --- | --- | --- | --- | --- | --- | --- |
| 123 Maple St, Apt 4B, Springfield, IL 62701 | Yes | - | 555-0198 | - | Email | j.doe@example.com |

## Household
| Household Member Name | Relationship | DOB | Phone | Notes |
| --- | --- | --- | --- | --- |
| Jane Doe | Daughter | 11/22/2015 | - | - |

## Authorized Reps
| Rep Name | Rep Contact Info | Rep Address | Notes |
| --- | --- | --- | --- |
| - | - | - | - |

## Income
| Income Category | Description | Account Number | Owner | Amount | Frequency | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Wages | Cashier at Grocery Store | - | John Doe | 1200 | Monthly | - |

## Resources
| Account Type | Financial Institution | Account Number | Owner | Amount | Frequency | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Checking | First National Bank | 9988 | John Doe | 350 | - | - |

## Expenses
| Expense Category | Description | Account Number | Owner | Amount | Frequency | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Rent | Apartment Monthly Rent | - | John Doe | 800 | Monthly | - |

## Review Items
| Missing Info | Conflicts | Follow Up |
| --- | --- | --- |
| Missing recent pay stubs | - | Request proof of income for October |
`;

describe("parseMarkdownCaseImport", () => {
  it("maps intake-safe fields and reports unsupported sections and fields", () => {
    // ARRANGE & ACT
    const result = parseMarkdownCaseImport(strictMarkdownFixture);

    // ASSERT
    expect(result.initialData).toMatchObject({
      firstName: "John",
      lastName: "Doe",
      dateOfBirth: "1982-05-14",
      maritalStatus: "Single",
      phone: "555-0198",
      email: "j.doe@example.com",
      mcn: "CASE-98765",
      withWaiver: true,
      retroRequested: "3",
      applicationDate: "2023-10-12",
      address: {
        street: "123 Maple St",
        apt: "Apt 4B",
        city: "Springfield",
        state: "IL",
        zip: "62701",
      },
      mailingAddress: {
        sameAsPhysical: true,
      },
    });
    expect(result.initialData.householdMembers).toHaveLength(1);
    expect(result.initialData.householdMembers?.[0]).toMatchObject({
      firstName: "Jane",
      lastName: "Doe",
      relationshipType: "Daughter",
      dateOfBirth: "2015-11-22",
      phone: "",
    });
    expect(result.unsupportedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "Contact Info",
          label: "Preferred Message Delivery",
          value: "Email",
        }),
      ]),
    );
    expect(result.unsupportedSections).toEqual([
      "Authorized Reps",
      "Income",
      "Resources",
      "Expenses",
      "Review Items",
    ]);
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
