import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMarkdownCaseImportFlow } from "@/hooks/useMarkdownCaseImportFlow";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const importFixture = `
## Person Info
- First Name: Jamie
- Last Name: Rivera
## Case Info
- Case ID: MCN-101
- Application Date: 2026-03-25
`;

describe("useMarkdownCaseImportFlow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates an ephemeral intake draft on confirm and starts intake", () => {
    // ARRANGE
    const onStartIntake = vi.fn();
    const { result } = renderHook(() => useMarkdownCaseImportFlow({ onStartIntake }));

    // ACT
    act(() => {
      result.current.openImportModal();
      result.current.handleInputChange(importFixture);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    let didConfirm = false;
    act(() => {
      didConfirm = result.current.confirmImport();
    });

    // ASSERT
    expect(didConfirm).toBe(true);
    expect(onStartIntake).toHaveBeenCalledOnce();
    expect(result.current.importDraft).toMatchObject({
      firstName: "Jamie",
      lastName: "Rivera",
      mcn: "MCN-101",
      applicationDate: "2026-03-25",
    });
    expect(result.current.importState).toEqual({
      isOpen: false,
      rawInput: "",
      review: null,
    });
  });

  it("does not confirm when no importable intake data was found", () => {
    // ARRANGE
    const onStartIntake = vi.fn();
    const { result } = renderHook(() => useMarkdownCaseImportFlow({ onStartIntake }));

    // ACT
    act(() => {
      result.current.openImportModal();
      result.current.handleInputChange("## Notes\n- Something: else");
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    let didConfirm = true;
    act(() => {
      didConfirm = result.current.confirmImport();
    });

    // ASSERT
    expect(didConfirm).toBe(false);
    expect(onStartIntake).not.toHaveBeenCalled();
    expect(result.current.importDraft).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("No intake fields could be imported from that markdown.");
  });

  it("clears the ephemeral draft when requested", () => {
  it("clears the ephemeral draft when requested", () => {
    // ARRANGE
    const { result } = renderHook(() => useMarkdownCaseImportFlow({ onStartIntake: vi.fn() }));

    // ACT
    act(() => {
      result.current.openImportModal();
      result.current.handleInputChange(importFixture);
    });
    act(() => {
      result.current.confirmImport();
    });
    act(() => {
      result.current.clearImportDraft();
    });

    // ASSERT
    expect(result.current.importDraft).toBeNull();
  });

  it("waits for the debounce window before parsing review data", () => {
    // ARRANGE
    const { result } = renderHook(() => useMarkdownCaseImportFlow({ onStartIntake: vi.fn() }));

    // ACT
    act(() => {
      result.current.handleInputChange(importFixture);
    });

    // ASSERT
    expect(result.current.importState.review).toBeNull();
    expect(result.current.canConfirmImport).toBe(false);

    // ACT
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // ASSERT
    expect(result.current.importState.review?.hasImportedData).toBe(true);
    expect(result.current.canConfirmImport).toBe(true);
  });
});
