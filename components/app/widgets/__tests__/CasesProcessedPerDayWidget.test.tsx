import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WidgetMetadata } from "../WidgetRegistry";
import type { CaseActivityEntry } from "@/types/activityLog";
import { CasesProcessedPerDayWidget } from "../CasesProcessedPerDayWidget";

const mockUseWidgetData = vi.fn();

vi.mock("@/hooks/useWidgetData", () => ({
  useWidgetData: (...args: unknown[]) => mockUseWidgetData(...args),
}));

const freshness = {
  lastUpdatedAt: Date.now(),
  isStale: false,
  minutesAgo: 5,
};

const metadata: WidgetMetadata = {
  id: "cases-processed-per-day",
  title: "Cases Processed/Day",
};

const activity: CaseActivityEntry[] = [];

describe("CasesProcessedPerDayWidget", () => {
  beforeEach(() => {
    mockUseWidgetData.mockReset();
    // Mock the current date to ensure consistent test behavior
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 9, 22, 12, 0, 0)); // Oct 22, 2025, noon local time
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders processing trend", () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        daily: [
          { date: "2025-10-16", processedCount: 2 },
          { date: "2025-10-17", processedCount: 1 },
          { date: "2025-10-18", processedCount: 0 },
          { date: "2025-10-19", processedCount: 3 },
          { date: "2025-10-20", processedCount: 1 },
          { date: "2025-10-21", processedCount: 0 },
          { date: "2025-10-22", processedCount: 2 },
        ],
        total: 9,
        previousTotal: 6,
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(<CasesProcessedPerDayWidget activityLog={activity} metadata={metadata} />);

    expect(screen.getByText("Cases Processed/Day")).toBeInTheDocument();
    expect(screen.getByText(/9 processed/)).toBeInTheDocument();
  });

  it("renders empty state", () => {
    mockUseWidgetData.mockReturnValue({
      data: { daily: [], total: 0, previousTotal: 0 },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(<CasesProcessedPerDayWidget activityLog={activity} metadata={metadata} />);

    expect(screen.getByText(/no cases processed/i)).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockUseWidgetData.mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed"),
      freshness,
      refresh: vi.fn(),
    });

    render(<CasesProcessedPerDayWidget activityLog={activity} metadata={metadata} />);

    expect(screen.getByText(/unable to calculate case completions/i)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        daily: [
          { date: "2025-10-16", processedCount: 1 },
          { date: "2025-10-17", processedCount: 4 },
          { date: "2025-10-18", processedCount: 2 },
          { date: "2025-10-19", processedCount: 0 },
          { date: "2025-10-20", processedCount: 3 },
          { date: "2025-10-21", processedCount: 1 },
          { date: "2025-10-22", processedCount: 2 },
        ],
        total: 13,
        previousTotal: 10,
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    const { container } = render(<CasesProcessedPerDayWidget activityLog={activity} metadata={metadata} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
