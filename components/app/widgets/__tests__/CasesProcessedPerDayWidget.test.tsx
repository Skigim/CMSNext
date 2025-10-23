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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders processing trend", () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        daily: [
          { date: "2025-10-16", processedCount: 2 },
          { date: "2025-10-17", processedCount: 1 },
        ],
        total: 3,
        previousTotal: 2,
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(<CasesProcessedPerDayWidget activityLog={activity} metadata={metadata} />);

    expect(screen.getByText("Cases Processed/Day")).toBeInTheDocument();
    expect(screen.getByText(/3 processed/)).toBeInTheDocument();
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
        ],
        total: 5,
        previousTotal: 3,
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
