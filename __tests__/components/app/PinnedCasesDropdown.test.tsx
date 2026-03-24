import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import { fireEvent, render } from "@/src/test/reactTestUtils";
import { PinnedCasesDropdown } from "@/components/app/PinnedCasesDropdown";
import { usePinnedCases } from "@/hooks/usePinnedCases";
import { createMockStoredCase } from "@/src/test/testUtils";

vi.mock("@/hooks/usePinnedCases", () => ({
  usePinnedCases: vi.fn(),
}));

const usePinnedCasesMock = vi.mocked(usePinnedCases);

describe("PinnedCasesDropdown", () => {
  beforeEach(() => {
    usePinnedCasesMock.mockReset();
  });

  it("does not prune persisted pins before case data has finished loading", () => {
    const pruneStale = vi.fn();

    usePinnedCasesMock.mockReturnValue({
      pinnedCaseIds: ["case-1"],
      pin: vi.fn(),
      unpin: vi.fn(),
      togglePin: vi.fn(),
      isPinned: vi.fn(),
      getPinReason: vi.fn(),
      canPinMore: true,
      pinnedCount: 1,
      reorder: vi.fn(),
      pruneStale,
    });

    const { rerender } = render(
      <PinnedCasesDropdown
        cases={[]}
        hasLoadedData={false}
        onViewCase={vi.fn()}
      />,
    );

    expect(pruneStale).not.toHaveBeenCalled();

    rerender(
      <PinnedCasesDropdown
        cases={[createMockStoredCase({ id: "case-1" })]}
        hasLoadedData={true}
        onViewCase={vi.fn()}
      />,
    );

    expect(pruneStale).not.toHaveBeenCalled();
  });

  it("prunes stale pins after case data has finished loading", () => {
    const pruneStale = vi.fn();

    usePinnedCasesMock.mockReturnValue({
      pinnedCaseIds: ["case-1", "missing-case"],
      pin: vi.fn(),
      unpin: vi.fn(),
      togglePin: vi.fn(),
      isPinned: vi.fn(),
      getPinReason: vi.fn(),
      canPinMore: true,
      pinnedCount: 2,
      reorder: vi.fn(),
      pruneStale,
    });

    render(
      <PinnedCasesDropdown
        cases={[createMockStoredCase({ id: "case-1" })]}
        hasLoadedData={true}
        onViewCase={vi.fn()}
      />,
    );

    expect(pruneStale).toHaveBeenCalledWith(["case-1"]);
  });

  it("shows the stored pin reason with the pinned case", async () => {
    // ARRANGE
    usePinnedCasesMock.mockReturnValue({
      pinnedCaseIds: ["case-1"],
      pin: vi.fn(),
      unpin: vi.fn(),
      togglePin: vi.fn(),
      isPinned: vi.fn(),
      getPinReason: vi.fn((caseId: string) =>
        caseId === "case-1" ? "Pending morning triage" : undefined
      ),
      canPinMore: true,
      pinnedCount: 1,
      reorder: vi.fn(),
      pruneStale: vi.fn(),
    });

    const { baseElement, getByRole, getByTestId, findByText } = render(
      <PinnedCasesDropdown
        cases={[createMockStoredCase({ id: "case-1", name: "Case One" })]}
        hasLoadedData={true}
        onViewCase={vi.fn()}
      />,
    );

    // ACT
    fireEvent.pointerDown(getByRole("button", { name: "Pinned cases (1)" }));
    const results = await axe(baseElement, {
      rules: {
        region: { enabled: false },
      },
    });

    // ASSERT
    expect(results).toHaveNoViolations();
    expect(await findByText("Pending morning triage")).toBeInTheDocument();
    expect(getByTestId("pinned-cases-scroll-wrapper")).toBeInTheDocument();
    expect(getByTestId("pinned-cases-scroll-area")).toBeInTheDocument();
  });

  it("shows Needs Intake for pinned incomplete cases", async () => {
    // ARRANGE
    usePinnedCasesMock.mockReturnValue({
      pinnedCaseIds: ["case-1"],
      pin: vi.fn(),
      unpin: vi.fn(),
      togglePin: vi.fn(),
      isPinned: vi.fn(),
      getPinReason: vi.fn(),
      canPinMore: true,
      pinnedCount: 1,
      reorder: vi.fn(),
      pruneStale: vi.fn(),
    });

    const baseCase = createMockStoredCase();
    const { getByRole, findByText } = render(
      <PinnedCasesDropdown
        cases={[
          createMockStoredCase({
            id: "case-1",
            name: "Case One",
            caseRecord: {
              ...baseCase.caseRecord,
              intakeCompleted: false,
            },
          }),
        ]}
        hasLoadedData={true}
        onViewCase={vi.fn()}
      />,
    );

    // ACT
    fireEvent.pointerDown(getByRole("button", { name: "Pinned cases (1)" }));

    // ASSERT
    expect(await findByText("Needs Intake")).toBeInTheDocument();
  });
});
