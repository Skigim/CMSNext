import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
import {
  createMockCaseRecord,
  createMockPerson,
  createMockStoredCase,
} from "@/src/test/testUtils";

const mockCase: StoredCase = createMockStoredCase({
  id: "case-1",
  name: "Test Case",
  mcn: "MCN001",
  status: "Active",
  person: createMockPerson({
    firstName: "John",
    lastName: "Doe",
    name: "John Doe",
    email: "",
    phone: "",
    dateOfBirth: "",
    ssn: "",
    livingArrangement: "",
    address: { street: "", city: "", state: "", zip: "" },
    mailingAddress: { street: "", city: "", state: "", zip: "", sameAsPhysical: true },
  }),
  caseRecord: createMockCaseRecord({
    mcn: "MCN001",
    status: "Active",
    personId: "person-test-1",
    applicationDate: "",
    caseType: "",
    description: "",
    livingArrangement: "",
    admissionDate: "",
    organizationId: "",
    updatedDate: "",
  }),
});

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
  function renderVRGeneratorModal() {
    return render(
      <VRGeneratorModal
        open={true}
        onOpenChange={vi.fn()}
        storedCase={mockCase}
        financialItems={mockFinancialItems}
        vrTemplates={mockTemplates}
      />,
    );
  }

  it("renders the modal when open", () => {
    // ARRANGE
    renderVRGeneratorModal();

    // ASSERT
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Generate Verification Requests" }),
    ).toBeInTheDocument();
  });

  it("financial item toggle buttons are keyboard accessible with Enter", async () => {
    // ARRANGE
    const user = userEvent.setup();
    renderVRGeneratorModal();
    const itemToggle = screen.getByRole("button", { name: /Wages/i });

    expect(itemToggle).toHaveAttribute("aria-pressed", "false");
    itemToggle.focus();

    // ACT
    await user.keyboard("{Enter}");

    // ASSERT
    expect(itemToggle).toHaveAttribute("aria-pressed", "true");
  });

  it("financial item toggle buttons expose aria-pressed state", () => {
    // ARRANGE
    renderVRGeneratorModal();
    const itemToggle = screen.getByRole("button", { name: /Wages/i });

    // ASSERT
    expect(itemToggle).toHaveAttribute("aria-pressed", "false");
  });

  it("financial item toggle buttons are focusable for keyboard interaction", () => {
    // ARRANGE
    renderVRGeneratorModal();
    const itemToggle = screen.getByRole("button", { name: /Wages/i });

    // ACT
    itemToggle.focus();

    // ASSERT
    expect(itemToggle).toHaveFocus();
  });
});
