import { describe, expect, it, vi } from "vitest";
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
  it("provides an accessible description for the edit dialog", () => {
    render(
      <CaseEditModal
        isOpen={true}
        onClose={vi.fn()}
        caseData={createMockStoredCase()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole("dialog", { name: /Edit Case:/i })).toHaveAccessibleDescription(
      "Update the case details, contact information, eligibility data, and relationships, then save your changes when you are finished.",
    );
  });
});