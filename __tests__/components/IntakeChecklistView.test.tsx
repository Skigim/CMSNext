import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import { IntakeChecklistView } from "@/components/case/IntakeChecklistView";
import { createMockStoredCase } from "@/src/test/testUtils";
import type { StoredCase } from "@/types/case";

expect.extend(toHaveNoViolations);

vi.mock("@/utils/clipboard", () => ({
  clickToCopy: vi.fn().mockResolvedValue(true),
}));

function createCaseWithPhone(phone: string): StoredCase {
  return createMockStoredCase({
    person: {
      id: "person-1",
      firstName: "Jane",
      lastName: "Smith",
      name: "Jane Smith",
      phone,
      email: "jane@example.com",
      dateOfBirth: "1985-05-15",
      ssn: "***-**-4567",
      organizationId: null,
      livingArrangement: "Home",
      address: {
        street: "456 Oak Ave",
        city: "Springfield",
        state: "IL",
        zip: "62701",
      },
      mailingAddress: {
        street: "456 Oak Ave",
        city: "Springfield",
        state: "IL",
        zip: "62701",
        sameAsPhysical: true,
      },
      authorizedRepIds: [],
      familyMembers: [],
      status: "Active",
      createdAt: "2025-01-01T00:00:00.000Z",
      dateAdded: "2025-01-01T00:00:00.000Z",
    },
  });
}

describe("IntakeChecklistView", () => {
  describe("Phone number formatting", () => {
    it("formats 10-digit phone number as (XXX) XXX-XXXX", () => {
      const caseData = createCaseWithPhone("5551234567");

      render(<IntakeChecklistView caseData={caseData} />);

      expect(screen.getByText("(555) 123-4567")).toBeInTheDocument();
    });

    it("formats 11-digit phone number with country code", () => {
      const caseData = createCaseWithPhone("15559876543");

      render(<IntakeChecklistView caseData={caseData} />);

      expect(screen.getByText("+1 (555) 987-6543")).toBeInTheDocument();
    });

    it("displays already formatted phone numbers correctly", () => {
      const caseData = createCaseWithPhone("(555) 111-2222");

      render(<IntakeChecklistView caseData={caseData} />);

      expect(screen.getByText("(555) 111-2222")).toBeInTheDocument();
    });

    it("displays incomplete phone numbers as-is", () => {
      const caseData = createCaseWithPhone("555");

      render(<IntakeChecklistView caseData={caseData} />);

      expect(screen.getByText("555")).toBeInTheDocument();
    });

    it("handles empty phone number gracefully", () => {
      const caseData = createCaseWithPhone("");

      render(<IntakeChecklistView caseData={caseData} />);

      // Phone field should not be rendered when empty
      expect(screen.queryByText(/Phone/)).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have no accessibility violations", async () => {
      const caseData = createCaseWithPhone("5551234567");

      const { container } = render(<IntakeChecklistView caseData={caseData} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Component rendering", () => {
    it("displays applicant information section", () => {
      const caseData = createCaseWithPhone("5551234567");

      render(<IntakeChecklistView caseData={caseData} />);

      expect(screen.getByText("Applicant Information")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    it("displays checklist sections", () => {
      const caseData = createCaseWithPhone("5551234567");

      render(<IntakeChecklistView caseData={caseData} />);

      expect(screen.getByText("Initial Checks")).toBeInTheDocument();
      expect(screen.getByText("Eligibility Verification")).toBeInTheDocument();
      expect(screen.getByText("Verification Reviews")).toBeInTheDocument();
    });

    it("displays completion stats badge", () => {
      const caseData = createCaseWithPhone("5551234567");

      render(<IntakeChecklistView caseData={caseData} />);

      expect(screen.getByText(/complete$/)).toBeInTheDocument();
    });
  });
});
