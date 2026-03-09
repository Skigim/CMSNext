import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAmountHistoryEntry, createMockFinancialItem, createMockStoredCase } from "@/src/test/testUtils";

vi.mock("@/contexts/DataManagerContext", () => ({
  useDataManagerSafe: () => null,
}));

import { useFinancialItemFlow } from "@/hooks/useFinancialItemFlow";

describe("useFinancialItemFlow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("initializes edit form verification fields from the current history entry", () => {
    const selectedCase = createMockStoredCase({ id: "case-1" });
    const setError = vi.fn();
    const item = createMockFinancialItem("resources", {
      id: "resource-1",
      amount: 10,
      verificationStatus: "Needs VR",
      verificationSource: "Legacy",
      amountHistory: [
        createMockAmountHistoryEntry({
          id: "entry-1",
          amount: 250,
          startDate: "2025-06-01",
          verificationStatus: "Verified",
          verificationSource: "AVS",
        }),
      ],
    });

    const { result } = renderHook(() =>
      useFinancialItemFlow({
        selectedCase,
        setError,
      }),
    );

    act(() => {
      result.current.openItemForm("resources", item);
    });

    expect(result.current.formData.amount).toBe(250);
    expect(result.current.formData.verificationStatus).toBe("Verified");
    expect(result.current.formData.verificationSource).toBe("AVS");
  });
});
