import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import userEvent from "@testing-library/user-event";

expect.extend(toHaveNoViolations);

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

vi.mock("@/utils/clipboard", () => ({
  clickToCopy: vi.fn().mockResolvedValue(true),
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
import { clickToCopy } from "@/utils/clipboard";
import { renderTemplate } from "@/utils/vrGenerator";
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

const DEFAULT_VR_COPY_FOOTER =
  "Please return the requested verification as soon as possible.\n\nThank you.";

describe("VRGeneratorModal - keyboard accessibility", () => {
  function renderVRGeneratorModal(footerTemplate?: Template | null) {
    return render(
      <VRGeneratorModal
        open={true}
        onOpenChange={vi.fn()}
        storedCase={mockCase}
        financialItems={mockFinancialItems}
        vrTemplates={mockTemplates}
        footerTemplate={footerTemplate}
      />,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(renderTemplate).mockReturnValue("Template output");
  });

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

  it("shows an enabled footer toggle with helper text for copy behavior", () => {
    // ARRANGE
    renderVRGeneratorModal();

    // ASSERT
    expect(
      screen.getByRole("checkbox", { name: "Append footer when copying" }),
    ).toBeChecked();
    expect(
      screen.getByText(/Adds this footer to clipboard text only:/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Please return the requested verification/i)).toBeInTheDocument();
  });

  it("appends the default footer when copying by default", async () => {
    // ARRANGE
    const user = userEvent.setup();
    renderVRGeneratorModal();

    // ACT
    await user.type(screen.getByLabelText("Preview"), "Template output");
    await user.click(screen.getByRole("button", { name: "Copy to Clipboard" }));

    // ASSERT
    expect(clickToCopy).toHaveBeenCalledWith(
      `Template output\n\n${DEFAULT_VR_COPY_FOOTER}`,
      {
        successMessage: "VR copied to clipboard",
        errorMessage: "Failed to copy to clipboard",
      },
    );
  });

  it("skips the footer when the checkbox is unchecked before copying", async () => {
    // ARRANGE
    const user = userEvent.setup();
    renderVRGeneratorModal();

    // ACT
    await user.click(screen.getByRole("checkbox", { name: "Append footer when copying" }));
    await user.type(screen.getByLabelText("Preview"), "Template output");
    await user.click(screen.getByRole("button", { name: "Copy to Clipboard" }));

    // ASSERT
    expect(clickToCopy).toHaveBeenCalledWith("Template output", {
      successMessage: "VR copied to clipboard",
      errorMessage: "Failed to copy to clipboard",
    });
  });

  it("uses the configured footer template preview and copy text when provided", async () => {
    // ARRANGE
    const footerTemplate: Template = {
      id: "footer-1",
      name: "Custom Footer",
      category: "vrFooter",
      template: "Handled by {caseName}",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortOrder: 0,
    };
    vi.mocked(renderTemplate).mockImplementation((template: string) => {
      if (template === footerTemplate.template) {
        return "Handled by Test Case";
      }

      return "Template output";
    });
    const user = userEvent.setup();
    renderVRGeneratorModal(footerTemplate);

    // ASSERT
    expect(screen.getByText(/Handled by Test Case/i)).toBeInTheDocument();

    // ACT
    await user.type(screen.getByLabelText("Preview"), "Template output");
    await user.click(screen.getByRole("button", { name: "Copy to Clipboard" }));

    // ASSERT
    expect(clickToCopy).toHaveBeenCalledWith("Template output\n\nHandled by Test Case", {
      successMessage: "VR copied to clipboard",
      errorMessage: "Failed to copy to clipboard",
    });
  });

  it("has no accessibility violations with the footer toggle enabled", async () => {
    // ARRANGE
    const { container } = renderVRGeneratorModal();

    // ACT
    const results = await axe(container);

    // ASSERT
    expect(results).toHaveNoViolations();
  });
});
