import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import {
  CaseIdentificationSection,
  CaseFlagsSection,
  EligibilityDetailsSection,
  RelationshipsSection,
} from "@/components/case/CaseEditSections";
import { createMockCaseRecord, createMockPerson } from "@/src/test/testUtils";
import type { Relationship } from "@/types/case";

expect.extend(toHaveNoViolations);

const mockCategoryConfig = {
  caseTypes: ["Medical Assistance"],
  applicationTypes: ["New", "Renewal"],
  caseStatuses: [{ name: "Pending", colorSlot: "blue" }],
  livingArrangements: ["Home"],
  groups: [],
  caseCategories: [],
};

vi.mock("@/contexts/CategoryConfigContext", () => ({
  useCategoryConfig: () => ({
    config: mockCategoryConfig,
  }),
}));

describe("CaseIdentificationSection", () => {
  it("disables application-owned edit controls", async () => {
    // ARRANGE
    const onCaseDataChange = vi.fn();

    // ACT
    const { container } = render(
      <CaseIdentificationSection
        caseData={createMockCaseRecord({
          applicationType: "Renewal",
          applicationDate: "2026-01-02T00:00:00.000Z",
          status: "Pending",
          avsConsentDate: "2026-01-03T00:00:00.000Z",
        })}
        isEditing={true}
        onCaseDataChange={onCaseDataChange}
      />,
    );

    // ASSERT
    expect(screen.getByLabelText(/App Type/i)).toBeDisabled();
    expect(screen.getByLabelText(/Application Date/i)).toBeDisabled();
    expect(screen.getByLabelText(/^Status$/i)).toBeDisabled();
    expect(screen.getByLabelText(/AVS Consent Date/i)).toBeDisabled();
    expect(screen.getByLabelText(/Voter Form/i)).toBeDisabled();
    expect(screen.getByLabelText(/AVS Submit Date/i)).toBeEnabled();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("EligibilityDetailsSection", () => {
  it("keeps case-owned details editable while disabling application-owned verification fields", async () => {
    // ARRANGE
    const person = createMockPerson();
    const onCaseDataChange = vi.fn();

    // ACT
    const { container } = render(
      <EligibilityDetailsSection
        personData={person}
        caseData={createMockCaseRecord({
          appValidated: true,
          maritalStatus: "Single",
        })}
        isEditing={true}
        onPersonDataChange={vi.fn()}
        onCaseDataChange={onCaseDataChange}
      />,
    );

    // ASSERT
    expect(screen.getByLabelText(/Citizenship/i)).toBeDisabled();
    expect(screen.getByLabelText(/Residency/i)).toBeDisabled();
    expect(screen.getByLabelText(/Aged\/Disabled/i)).toBeDisabled();
    expect(screen.getByLabelText(/App Validated/i)).toBeDisabled();
    expect(screen.getByLabelText(/Pregnancy/i)).toBeEnabled();
    expect(screen.getByLabelText(/Marital Status/i)).toBeEnabled();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("CaseFlagsSection", () => {
  it("disables application-owned retro controls while keeping priority editable", async () => {
    // ARRANGE
    const onCaseDataChange = vi.fn();

    // ACT
    const { container } = render(
      <CaseFlagsSection
        caseData={createMockCaseRecord({
          priority: true,
          withWaiver: true,
          retroMonths: ["Jan", "Feb", "Mar"],
        })}
        retroRequested={true}
        isEditing={true}
        onCaseDataChange={onCaseDataChange}
        onRetroRequestedChange={vi.fn()}
      />,
    );

    // ASSERT
    expect(screen.getByLabelText(/Priority Case/i)).toBeEnabled();
    expect(screen.getByLabelText(/With Waiver/i)).toBeDisabled();
    expect(screen.getByLabelText(/Retro Requested/i)).toBeDisabled();
    expect(screen.getByLabelText(/Retro Months/i)).toBeDisabled();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("RelationshipsSection", () => {
  it("keeps relationship fields aligned and renders remove action outside inputs", () => {
    // ARRANGE
    const relationships: Relationship[] = [
      { id: "rel-1", type: "Spouse", name: "Alex Example", phone: "1234567890" },
    ];

    // ACT
    render(
      <RelationshipsSection
        relationships={relationships}
        isEditing
        onRelationshipsChange={{
          add: vi.fn(),
          update: vi.fn(),
          remove: vi.fn(),
        }}
      />,
    );

    const typeSelect = screen.getByRole("combobox");
    const nameInput = screen.getByPlaceholderText("Name");
    const phoneInput = screen.getByPlaceholderText("Phone");
    const removeButton = screen.getByRole("button", { name: /remove relationship 1/i });
    const rowGrid = removeButton.parentElement;

    // ASSERT
    expect(typeSelect).toHaveClass("h-8");
    expect(nameInput).toHaveClass("h-8");
    expect(phoneInput).toHaveClass("h-8");
    expect(removeButton).toHaveClass("h-8");
    expect(removeButton).not.toHaveClass("absolute");
    expect(rowGrid).not.toBeNull();
    expect(rowGrid).toHaveClass("grid-cols-[repeat(3,minmax(0,1fr))_auto]");
    expect(rowGrid?.lastElementChild).toBe(removeButton);
    expect(rowGrid).toContainElement(typeSelect);
    expect(rowGrid).toContainElement(nameInput);
    expect(rowGrid).toContainElement(phoneInput);
  });
});
