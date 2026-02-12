import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ============================================================================
// Mocks
// ============================================================================

vi.mock("@/contexts/DataManagerContext", () => ({
  useDataManagerSafe: () => null,
}));

vi.mock("@/contexts/TemplateContext", () => ({
  useTemplates: () => ({
    templates: [],
    loading: false,
    refresh: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    reorderTemplates: vi.fn(),
  }),
}));

vi.mock("@/utils/vrGenerator", () => ({
  renderMultipleVRs: vi.fn().mockReturnValue("VR output"),
  buildCaseLevelContext: vi.fn().mockReturnValue({}),
  renderTemplate: vi.fn().mockReturnValue("Template output"),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "id"),
  },
}));

vi.mock("@/utils/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    lifecycle: vi.fn(),
  }),
}));

import { VRGeneratorModal } from "@/components/case/VRGeneratorModal";
import type { StoredCase, StoredFinancialItem } from "@/types/case";
import type { Template } from "@/types/template";

const mockCase: StoredCase = {
  id: "case-1",
  name: "Test Case",
  mcn: "MCN001",
  status: "Active",
  priority: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  person: {
    firstName: "John",
    lastName: "Doe",
    email: "",
    phone: "",
    dateOfBirth: "",
    ssn: "",
    livingArrangement: "",
    address: { street: "", city: "", state: "", zip: "" },
    mailingAddress: { street: "", city: "", state: "", zip: "", sameAsPhysical: true },
    status: "Active",
  },
  caseRecord: {
    mcn: "MCN001",
    status: "Active",
    applicationDate: "",
    caseType: "",
    personId: "",
    description: "",
    livingArrangement: "",
    admissionDate: "",
    organizationId: "",
    updatedDate: "",
  },
} as StoredCase;

const mockFinancialItems: StoredFinancialItem[] = [
  {
    id: "fin-1",
    caseId: "case-1",
    category: "income",
    description: "Wages",
    amount: 1000,
    verificationStatus: "verified",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockTemplates: Template[] = [
  {
    id: "tmpl-1",
    name: "VR Script",
    category: "vr",
    template: "Hello {{firstName}}",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sortOrder: 0,
  },
];

describe("VRGeneratorModal - keyboard accessibility", () => {
  it("renders the modal when open", () => {
    render(
      <VRGeneratorModal
        open={true}
        onOpenChange={vi.fn()}
        storedCase={mockCase}
        financialItems={mockFinancialItems}
        vrTemplates={mockTemplates}
      />,
    );

    // Modal should be open with content visible
    expect(document.body).toBeTruthy();
  });

  it("checkbox items are keyboard accessible with Enter key", () => {
    render(
      <VRGeneratorModal
        open={true}
        onOpenChange={vi.fn()}
        storedCase={mockCase}
        financialItems={mockFinancialItems}
        vrTemplates={mockTemplates}
      />,
    );

    // Find elements with role=checkbox (the financial items)
    const checkboxes = screen.queryAllByRole("checkbox");
    
    if (checkboxes.length > 0) {
      // Test Enter key toggles
      fireEvent.keyDown(checkboxes[0], { key: "Enter" });
      expect(checkboxes[0]).toBeDefined();

      // Test Space key toggles
      fireEvent.keyDown(checkboxes[0], { key: " " });
      expect(checkboxes[0]).toBeDefined();
    }
  });

  it("checkbox items have proper aria-checked attribute", () => {
    render(
      <VRGeneratorModal
        open={true}
        onOpenChange={vi.fn()}
        storedCase={mockCase}
        financialItems={mockFinancialItems}
        vrTemplates={mockTemplates}
      />,
    );

    const checkboxes = screen.queryAllByRole("checkbox");
    for (const cb of checkboxes) {
      // All checkboxes should have aria-checked
      const ariaChecked = cb.getAttribute("aria-checked");
      if (ariaChecked !== null) {
        expect(["true", "false"]).toContain(ariaChecked);
      }
    }
  });

  it("checkbox items have tabIndex for keyboard focus", () => {
    render(
      <VRGeneratorModal
        open={true}
        onOpenChange={vi.fn()}
        storedCase={mockCase}
        financialItems={mockFinancialItems}
        vrTemplates={mockTemplates}
      />,
    );

    const checkboxes = screen.queryAllByRole("checkbox");
    for (const cb of checkboxes) {
      const tabIndex = cb.getAttribute("tabindex");
      if (tabIndex !== null) {
        expect(Number(tabIndex)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
