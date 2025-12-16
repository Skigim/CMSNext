/**
 * VR Generator Utility Tests
 * 
 * Tests for the VR template rendering and placeholder substitution system.
 */

import { describe, it, expect } from "vitest";
import {
  buildRenderContext,
  renderTemplate,
  renderVR,
  renderMultipleVRs,
  getPlaceholdersByCategory,
  createDefaultVRScript,
} from "@/utils/vrGenerator";
import type { FinancialItem, StoredCase, Person, CaseRecord } from "@/types/case";
import type { VRScript } from "@/types/vr";

// ============================================================================
// Mock Data Factories
// ============================================================================

function createMockPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: "person-1",
    firstName: "John",
    lastName: "Doe",
    name: "John Doe",
    phone: "5551234567",
    email: "john.doe@example.com",
    ssn: "123-45-6789",
    dateOfBirth: "1980-05-15",
    organizationId: null,
    livingArrangement: "Apartment/House",
    status: "Active",
    createdAt: "2024-01-01T10:00:00Z",
    dateAdded: "2024-01-01",
    authorizedRepIds: [],
    familyMembers: [],
    address: {
      street: "123 Main St",
      city: "Springfield",
      state: "IL",
      zip: "62701",
    },
    mailingAddress: {
      sameAsPhysical: true,
      street: "",
      city: "",
      state: "",
      zip: "",
    },
    ...overrides,
  };
}

function createMockCaseRecord(overrides: Partial<CaseRecord> = {}): Omit<CaseRecord, "financials" | "notes"> {
  return {
    id: "record-1",
    mcn: "MCN123456",
    caseType: "Medicaid",
    applicationDate: "2024-01-15",
    status: "Pending",
    personId: "person-1",
    spouseId: "",
    description: "",
    priority: false,
    livingArrangement: "Apartment/House",
    withWaiver: false,
    admissionDate: "",
    organizationId: "",
    authorizedReps: [],
    retroRequested: "",
    createdDate: "2024-01-01T10:00:00Z",
    updatedDate: "2024-01-15T10:00:00Z",
    ...overrides,
  };
}

function createMockStoredCase(overrides: Partial<StoredCase> = {}): StoredCase {
  return {
    id: "case-1",
    name: "John Doe",
    mcn: "MCN123456",
    status: "Pending",
    priority: false,
    createdAt: "2024-01-01T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    person: createMockPerson(),
    caseRecord: createMockCaseRecord(),
    ...overrides,
  };
}

function createMockFinancialItem(overrides: Partial<FinancialItem> = {}): FinancialItem {
  return {
    id: "item-1",
    description: "Checking Account",
    amount: 1500.50,
    location: "First National Bank",
    owner: "John Doe",
    accountNumber: "****1234",
    frequency: "Monthly",
    verificationStatus: "Pending",
    verificationSource: "Bank Statement",
    dateAdded: "2024-01-10",
    notes: "Primary account",
    amountHistory: [
      {
        id: "history-1",
        amount: 1500.50,
        startDate: "2024-01-10",
        verificationSource: "Bank Statement",
        createdAt: "2024-01-10T10:00:00Z",
      },
      {
        id: "history-2",
        amount: 1200.00,
        startDate: "2024-01-05",
        verificationSource: "Client Report",
        createdAt: "2024-01-05T10:00:00Z",
      },
    ],
    createdAt: "2024-01-10T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    ...overrides,
  };
}

function createMockVRScript(overrides: Partial<VRScript> = {}): VRScript {
  return {
    id: "script-1",
    name: "Bank Account VR",
    template: "Account: {description}\nAmount: {amount}\nLocation: {location}\nClient: {caseName}",
    createdAt: "2024-01-01T10:00:00Z",
    updatedAt: "2024-01-01T10:00:00Z",
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("vrGenerator", () => {
  describe("buildRenderContext", () => {
    it("should build context from financial item and case data", () => {
      const item = createMockFinancialItem();
      const storedCase = createMockStoredCase();

      const context = buildRenderContext(item, "resources", storedCase);

      // Financial item fields
      expect(context.description).toBe("Checking Account");
      expect(context.amount).toBe(1500.50);
      expect(context.location).toBe("First National Bank");
      expect(context.owner).toBe("John Doe");
      expect(context.accountNumber).toBe("****1234");
      expect(context.frequency).toBe("Monthly");
      expect(context.verificationStatus).toBe("Pending");
      expect(context.verificationSource).toBe("Bank Statement");
      expect(context.itemNotes).toBe("Primary account");
      expect(context.itemType).toBe("Resource");

      // Case fields
      expect(context.caseName).toBe("John Doe");
      expect(context.caseNumber).toBe("MCN123456");
      expect(context.caseType).toBe("Medicaid");
      expect(context.caseStatus).toBe("Pending");

      // Person fields
      expect(context.clientFirstName).toBe("John");
      expect(context.clientLastName).toBe("Doe");
      expect(context.clientEmail).toBe("john.doe@example.com");
      expect(context.clientSSN).toBe("123-45-6789");
    });

    it("should format phone number correctly", () => {
      const item = createMockFinancialItem();
      const storedCase = createMockStoredCase();

      const context = buildRenderContext(item, "resources", storedCase);

      expect(context.clientPhone).toBe("(555) 123-4567");
    });

    it("should format address correctly", () => {
      const item = createMockFinancialItem();
      const storedCase = createMockStoredCase();

      const context = buildRenderContext(item, "resources", storedCase);

      expect(context.clientAddress).toBe("123 Main St, Springfield, IL, 62701");
    });

    it("should handle missing optional fields gracefully", () => {
      const item = createMockFinancialItem({
        accountNumber: undefined,
        notes: undefined,
        amountHistory: [],
      });
      const storedCase = createMockStoredCase({
        person: createMockPerson({
          phone: undefined,
          email: undefined,
          address: undefined,
        }),
      });

      const context = buildRenderContext(item, "income", storedCase);

      expect(context.accountNumber).toBe("");
      expect(context.itemNotes).toBe("");
      expect(context.clientPhone).toBe("");
      expect(context.clientEmail).toBe("");
      expect(context.clientAddress).toBe("");
    });

    it("should set correct itemType based on category", () => {
      const item = createMockFinancialItem();
      const storedCase = createMockStoredCase();

      expect(buildRenderContext(item, "resources", storedCase).itemType).toBe("Resource");
      expect(buildRenderContext(item, "income", storedCase).itemType).toBe("Incom");
      expect(buildRenderContext(item, "expenses", storedCase).itemType).toBe("Expense");
    });

    it("should use most recent history entry for lastUpdated", () => {
      const item = createMockFinancialItem({
        amountHistory: [
          { id: "h1", amount: 1000, startDate: "2024-01-01", verificationSource: "Old", createdAt: "2024-01-01T10:00:00Z" },
          { id: "h2", amount: 2000, startDate: "2024-01-15", verificationSource: "New", createdAt: "2024-01-15T10:00:00Z" },
        ],
      });
      const storedCase = createMockStoredCase();

      const context = buildRenderContext(item, "resources", storedCase);

      expect(context.lastUpdated).toBe("2024-01-15");
      expect(context.historyVerificationSource).toBe("New");
    });
  });

  describe("renderTemplate", () => {
    it("should substitute simple placeholders", () => {
      const template = "Hello, {clientFirstName} {clientLastName}!";
      const context = {
        clientFirstName: "Jane",
        clientLastName: "Smith",
      };

      const result = renderTemplate(template, context);

      expect(result).toBe("Hello, Jane Smith!");
    });

    it("should format currency amounts", () => {
      const template = "Balance: {amount}";
      const context = { amount: 1234.56 };

      const result = renderTemplate(template, context);

      expect(result).toBe("Balance: $1,234.56");
    });

    it("should format dates with full month name", () => {
      const template = "Added on: {dateAdded}";
      const context = { dateAdded: "2024-01-15" };

      const result = renderTemplate(template, context);

      expect(result).toBe("Added on: January 15, 2024");
    });

    it("should leave unknown placeholders unchanged", () => {
      const template = "Value: {unknownField}";
      const context = {};

      const result = renderTemplate(template, context);

      expect(result).toBe("Value: {unknownField}");
    });

    it("should handle empty values as empty strings", () => {
      const template = "Account: {accountNumber}";
      const context = { accountNumber: undefined };

      const result = renderTemplate(template, context);

      expect(result).toBe("Account: ");
    });

    it("should handle complex templates with multiple placeholders", () => {
      const template = `
Dear {clientFirstName},

Your case #{caseNumber} has been updated.
Current balance: {amount}

Thank you,
Case Management
`;
      const context = {
        clientFirstName: "John",
        caseNumber: "MCN123",
        amount: 500.00,
      };

      const result = renderTemplate(template, context);

      expect(result).toContain("Dear John,");
      expect(result).toContain("case #MCN123");
      expect(result).toContain("$500.00");
    });
  });

  describe("renderVR", () => {
    it("should render a complete VR from script and data", () => {
      const script = createMockVRScript();
      const item = createMockFinancialItem();
      const storedCase = createMockStoredCase();

      const result = renderVR(script, item, "resources", storedCase);

      expect(result.itemId).toBe("item-1");
      expect(result.scriptId).toBe("script-1");
      expect(result.text).toContain("Account: Checking Account");
      expect(result.text).toContain("$1,500.50");
      expect(result.text).toContain("Location: First National Bank");
      expect(result.text).toContain("Client: John Doe");
    });
  });

  describe("renderMultipleVRs", () => {
    it("should render multiple items with separator", () => {
      const script = createMockVRScript({
        template: "{description}: {amount}",
      });
      const items = [
        { item: createMockFinancialItem({ id: "1", description: "Account A", amount: 100 }), type: "resources" as const },
        { item: createMockFinancialItem({ id: "2", description: "Account B", amount: 200 }), type: "resources" as const },
      ];
      const storedCase = createMockStoredCase();

      const result = renderMultipleVRs(script, items, storedCase);

      expect(result).toContain("Account A: $100.00");
      expect(result).toContain("Account B: $200.00");
      expect(result).toContain("-----");
    });

    it("should handle single item without separator", () => {
      const script = createMockVRScript({
        template: "{description}",
      });
      const items = [
        { item: createMockFinancialItem({ description: "Only One" }), type: "resources" as const },
      ];
      const storedCase = createMockStoredCase();

      const result = renderMultipleVRs(script, items, storedCase);

      expect(result).toBe("Only One");
      expect(result).not.toContain("-----");
    });

    it("should handle empty items array", () => {
      const script = createMockVRScript();
      const storedCase = createMockStoredCase();

      const result = renderMultipleVRs(script, [], storedCase);

      expect(result).toBe("");
    });
  });

  describe("getPlaceholdersByCategory", () => {
    it("should return placeholders grouped by category", () => {
      const grouped = getPlaceholdersByCategory();

      expect(grouped["Financial Item"]).toBeDefined();
      expect(grouped["Case"]).toBeDefined();
      expect(grouped["Person"]).toBeDefined();
      expect(grouped["Amount History"]).toBeDefined();
      expect(grouped["System"]).toBeDefined();
    });

    it("should include description in Financial Item category", () => {
      const grouped = getPlaceholdersByCategory();
      const financialFields = grouped["Financial Item"];

      const descriptionField = financialFields.find(f => f.field === "description");
      expect(descriptionField).toBeDefined();
      expect(descriptionField?.label).toBe("Description");
    });

    it("should include currentDate in System category", () => {
      const grouped = getPlaceholdersByCategory();
      const systemFields = grouped["System"];

      const dateField = systemFields.find(f => f.field === "currentDate");
      expect(dateField).toBeDefined();
      expect(dateField?.label).toBe("Current Date");
    });
  });

  describe("createDefaultVRScript", () => {
    it("should create a script with generated ID", () => {
      const script = createDefaultVRScript("New Script");

      expect(script.id).toBeDefined();
      expect(script.id.length).toBeGreaterThan(0);
      expect(script.name).toBe("New Script");
      expect(script.template).toBe("");
    });

    it("should create a script with provided template", () => {
      const script = createDefaultVRScript("Template Script", "Hello {name}");

      expect(script.name).toBe("Template Script");
      expect(script.template).toBe("Hello {name}");
    });

    it("should set createdAt and updatedAt timestamps", () => {
      const before = new Date().toISOString();
      const script = createDefaultVRScript("Test");
      const after = new Date().toISOString();

      expect(script.createdAt >= before).toBe(true);
      expect(script.createdAt <= after).toBe(true);
      expect(script.updatedAt).toBe(script.createdAt);
    });
  });
});
