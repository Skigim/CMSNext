import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import type { ComponentType } from "react";

import { createMockPerson, createMockStoredCase } from "@/src/test/testUtils";

const mockIntakeFormView = vi.fn();
const mockSavedIntakeCase = createMockStoredCase({
  id: "case-saved-1",
  name: "Updated Intake Case",
  updatedAt: "2026-03-13T18:00:00.000Z",
  person: createMockPerson({
    id: "person-saved-1",
    firstName: "Updated",
    lastName: "Applicant",
    name: "Updated Applicant",
  }),
  caseRecord: {
    ...createMockStoredCase().caseRecord,
    personId: "person-saved-1",
    mcn: "UPDATED-MCN",
  },
});

vi.mock("@/hooks/useFinancialItems", () => ({
  useFinancialItems: () => ({
    groupedItems: {
      resources: [],
      income: [],
      expenses: [],
    },
    items: [],
  }),
}));

vi.mock("@/hooks/useNotes", () => ({
  useNotes: () => ({
    notes: [],
  }),
}));

vi.mock("@/contexts/TemplateContext", () => ({
  useTemplates: () => ({
    getTemplatesByCategory: () => [],
  }),
}));

vi.mock("@/components/case/FinancialsGridView", () => ({
  FinancialsGridView: () => <div data-testid="financials-grid" />,
}));

vi.mock("@/components/case/NotesPopover", () => ({
  NotesPopover: () => <div data-testid="notes-popover" />,
}));

vi.mock("@/components/case/AlertsPopover", () => ({
  AlertsPopover: () => <div data-testid="alerts-popover" />,
}));

vi.mock("@/components/case/IntakeFormView", () => ({
  IntakeFormView: (props: {
    existingCase?: StoredCase;
    onSuccess?: (savedCase: StoredCase) => void;
    onCancel?: () => void;
  }) => {
    mockIntakeFormView(props);
    return (
      <div data-testid="intake-form-view">
        <div data-testid="intake-case-name">{props.existingCase?.name}</div>
        <button
          type="button"
          onClick={() => props.onSuccess?.(mockSavedIntakeCase)}
        >
          Save Intake
        </button>
        <button type="button" onClick={() => props.onCancel?.()}>
          Cancel Intake
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/case/CaseSummaryModal", () => ({
  CaseSummaryModal: () => null,
}));

vi.mock("@/components/case/VRGeneratorModal", () => ({
  VRGeneratorModal: () => null,
}));

vi.mock("@/components/case/NarrativeGeneratorModal", () => ({
  NarrativeGeneratorModal: () => null,
}));

vi.mock("@/components/case/CaseStatusMenu", () => ({
  CaseStatusMenu: () => <div data-testid="case-status-menu" />,
}));

vi.mock("@/components/common/PinButton", () => ({
  PinButton: () => <button type="button">Pin</button>,
}));

vi.mock("@/components/error/ErrorBoundaryHOC", () => ({
  withDataErrorBoundary: <T extends object>(Component: ComponentType<T>) => Component,
}));

import { CaseDetails } from "@/components/case/CaseDetails";
import type { StoredCase } from "@/types/case";

const noOp = vi.fn();

function renderCaseDetails(caseData: StoredCase) {
  return render(
    <CaseDetails
      case={caseData}
      onBack={noOp}
      onDelete={noOp}
    />,
  );
}

describe("CaseDetails linked people rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIntakeFormView.mockClear();
  });

  it("has no accessibility violations", async () => {
    // Arrange
    const primaryPerson = createMockPerson({
      id: "person-a11y",
      firstName: "A11y",
      lastName: "Applicant",
      name: "A11y Applicant",
    });
    const caseData = createMockStoredCase({
      person: primaryPerson,
      linkedPeople: [
        {
          ref: { personId: primaryPerson.id, role: "applicant", isPrimary: true },
          person: primaryPerson,
        },
      ],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: primaryPerson.id,
      },
    });

    // Act
    const { container } = renderCaseDetails(caseData);
    const results = await axe(container);

    // Assert
    expect(results).toHaveNoViolations();
  });

  it("renders a single-person case without regressing primary contact details", () => {
    // Arrange
    const primaryPerson = createMockPerson({
      id: "person-1",
      firstName: "Single",
      lastName: "Applicant",
      name: "Single Applicant",
      phone: "5551234567",
      email: "single@example.com",
    });
    const caseData = createMockStoredCase({
      name: "Single Case",
      person: primaryPerson,
      people: [{ personId: primaryPerson.id, role: "applicant", isPrimary: true }],
      linkedPeople: [
        {
          ref: { personId: primaryPerson.id, role: "applicant", isPrimary: true },
          person: primaryPerson,
        },
      ],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: primaryPerson.id,
      },
    });

    // Act
    renderCaseDetails(caseData);

    // Assert
    expect(screen.getByText("Single Applicant")).toBeInTheDocument();
    expect(screen.getByText("Applicant")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Phone 5551234567" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Email single@example.com" })).toBeInTheDocument();
    expect(screen.queryByText("Household member")).not.toBeInTheDocument();
  });

  it("renders additional linked people with their role labels", () => {
    // Arrange
    const primaryPerson = createMockPerson({
      id: "person-1",
      firstName: "Primary",
      lastName: "Applicant",
      name: "Primary Applicant",
    });
    const householdMember = createMockPerson({
      id: "person-2",
      firstName: "Morgan",
      lastName: "Member",
      name: "Morgan Member",
    });
    const dependentPerson = createMockPerson({
      id: "person-3",
      firstName: "Devon",
      lastName: "Dependent",
      name: "Devon Dependent",
    });
    const caseData = createMockStoredCase({
      name: "Household Case",
      person: primaryPerson,
      people: [
        { personId: primaryPerson.id, role: "applicant", isPrimary: true },
        { personId: householdMember.id, role: "household_member", isPrimary: false },
        { personId: dependentPerson.id, role: "dependent", isPrimary: false },
      ],
      linkedPeople: [
        {
          ref: { personId: primaryPerson.id, role: "applicant", isPrimary: true },
          person: primaryPerson,
        },
        {
          ref: { personId: householdMember.id, role: "household_member", isPrimary: false },
          person: householdMember,
        },
        {
          ref: { personId: dependentPerson.id, role: "dependent", isPrimary: false },
          person: dependentPerson,
        },
      ],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: primaryPerson.id,
      },
    });

    // Act
    renderCaseDetails(caseData);

    // Assert
    expect(screen.getByText("Primary Applicant")).toBeInTheDocument();
    expect(screen.getByText("Morgan Member")).toBeInTheDocument();
    expect(screen.getByText("Devon Dependent")).toBeInTheDocument();
    expect(screen.getByText("Household member")).toBeInTheDocument();
    expect(screen.getByText("Dependent")).toBeInTheDocument();
  });

  it("swaps into IntakeFormView when edit details is opened", async () => {
    // Arrange
    const user = userEvent.setup();
    const caseData = createMockStoredCase();

    // Act
    renderCaseDetails(caseData);
    await user.click(screen.getByRole("button", { name: /Edit Details/i }));

    // Assert
    expect(screen.getByTestId("intake-form-view")).toBeInTheDocument();
  });

  it("reopens IntakeFormView with the saved case after a successful intake edit", async () => {
    // Arrange
    const user = userEvent.setup();
    const originalCase = createMockStoredCase({
      id: "case-saved-1",
      name: "Original Intake Case",
      updatedAt: "2026-03-13T17:00:00.000Z",
      person: createMockPerson({
        id: "person-original-1",
        firstName: "Original",
        lastName: "Applicant",
        name: "Original Applicant",
      }),
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: "person-original-1",
        mcn: "ORIGINAL-MCN",
      },
    });

    // Act
    renderCaseDetails(originalCase);
    await user.click(screen.getByRole("button", { name: /Edit Details/i }));
    await user.click(screen.getByRole("button", { name: /Save Intake/i }));

    // Assert
    expect(screen.getByText("Updated Intake Case")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Edit Details/i }));

    const reopenedIntakeProps = mockIntakeFormView.mock.lastCall?.[0];
    expect(reopenedIntakeProps).toEqual(
      expect.objectContaining({
        existingCase: expect.objectContaining({
          id: "case-saved-1",
          name: "Updated Intake Case",
          caseRecord: expect.objectContaining({
            mcn: "UPDATED-MCN",
          }),
        }),
      }),
    );
    expect(screen.getByTestId("intake-case-name")).toHaveTextContent(
      "Updated Intake Case",
    );
  });

  it("prioritizes the normalized primary person over a stale case.person", () => {
    // Arrange
    const staleHydratedPerson = createMockPerson({
      id: "person-2",
      firstName: "Secondary",
      lastName: "Person",
      name: "Secondary Person",
      phone: "5550002222",
      email: "secondary@example.com",
    });
    const normalizedPrimaryPerson = createMockPerson({
      id: "person-1",
      firstName: "Primary",
      lastName: "Applicant",
      name: "Primary Applicant",
      phone: "5550001111",
      email: "primary@example.com",
    });
    const secondaryLinkedPerson = createMockPerson({
      id: "person-2",
      firstName: "Secondary",
      lastName: "Person",
      name: "Secondary Person",
      phone: "5550002222",
      email: "secondary@example.com",
    });
    const caseData = createMockStoredCase({
      name: "Normalized Household",
      person: staleHydratedPerson,
      people: [
        { personId: normalizedPrimaryPerson.id, role: "applicant", isPrimary: true },
        { personId: secondaryLinkedPerson.id, role: "household_member", isPrimary: false },
      ],
      linkedPeople: [
        {
          ref: { personId: secondaryLinkedPerson.id, role: "household_member", isPrimary: false },
          person: secondaryLinkedPerson,
        },
        {
          ref: { personId: normalizedPrimaryPerson.id, role: "applicant", isPrimary: true },
          person: normalizedPrimaryPerson,
        },
      ],
      caseRecord: {
        ...createMockStoredCase().caseRecord,
        personId: normalizedPrimaryPerson.id,
      },
    });

    // Act
    renderCaseDetails(caseData);

    // Assert
    expect(screen.getByText("Primary Applicant")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Phone 5550001111" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Email primary@example.com" })).toBeInTheDocument();
    expect(screen.getByText("Secondary Person")).toBeInTheDocument();
    expect(screen.getByText("Household member")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Phone 5550002222" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Email secondary@example.com" })).not.toBeInTheDocument();
  });
});
