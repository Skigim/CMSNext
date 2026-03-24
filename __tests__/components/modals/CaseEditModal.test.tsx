import { describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import { render, screen } from "@/src/test/reactTestUtils";
import { createMockStoredCase } from "@/src/test/testUtils";
import { CaseEditModal } from "@/components/modals/CaseEditModal";

vi.mock("@/components/case/CaseEditSections", () => ({
  BasicInfoSection: () => <div>Basic info section</div>,
  ContactSection: () => <div>Contact section</div>,
  AddressesSection: () => <div>Addresses section</div>,
  CaseIdentificationSection: () => <div>Case identification section</div>,
  EligibilityDetailsSection: () => <div>Eligibility details section</div>,
  CaseFlagsSection: () => <div>Case flags section</div>,
  RelationshipsSection: () => <div>Relationships section</div>,
}));

vi.mock("@/hooks/useSubmitShortcut", () => ({
  useSubmitShortcut: () => vi.fn(),
}));

describe("CaseEditModal", () => {
  it("provides an accessible description for the edit dialog", async () => {
    // Arrange
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    // Act
    const { baseElement } = render(
      <CaseEditModal
        isOpen={true}
        onClose={onClose}
        caseData={createMockStoredCase()}
        onSave={onSave}
      />,
    );
    const results = await axe(baseElement);

    // Assert
    expect(results).toHaveNoViolations();
    expect(screen.getByRole("dialog", { name: /Edit Case:/i })).toHaveAccessibleDescription(
      "Update the case details, contact information, eligibility data, and relationships, then save your changes when you are finished.",
    );
  });
});