import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMarkdownCaseImportFlow } from "@/hooks/useMarkdownCaseImportFlow";

const importFixture = `
## Person Info
- First Name: Jamie
- Last Name: Rivera
## Case Info
- Case ID: MCN-101
- Application Date: 2026-03-25
`;

describe("useMarkdownCaseImportFlow", () => {
  it("creates an ephemeral intake draft on confirm and starts intake", () => {
    // ARRANGE
    const onStartIntake = vi.fn();
    const { result } = renderHook(() => useMarkdownCaseImportFlow({ onStartIntake }));

    // ACT
    act(() => {
      result.current.openImportModal();
      result.current.handleInputChange(importFixture);
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

    let didConfirm = true;
    act(() => {
      didConfirm = result.current.confirmImport();
    });

    // ASSERT
    expect(didConfirm).toBe(false);
    expect(onStartIntake).not.toHaveBeenCalled();
    expect(result.current.importDraft).toBeNull();
  });

  it("clears the ephemeral draft when requested", () => {
    // ARRANGE
    const { result } = renderHook(() => useMarkdownCaseImportFlow({ onStartIntake: vi.fn() }));

    // ACT
    act(() => {
      result.current.handleInputChange(importFixture);
      result.current.confirmImport();
      result.current.clearImportDraft();
    });

    // ASSERT
    expect(result.current.importDraft).toBeNull();
  });
});
