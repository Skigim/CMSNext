import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/src/test/reactTestUtils";
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
});
