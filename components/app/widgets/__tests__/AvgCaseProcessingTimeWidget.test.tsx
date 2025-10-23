import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WidgetMetadata } from "../WidgetRegistry";
import type { CaseActivityEntry } from "@/types/activityLog";
import type { CaseDisplay } from "@/types/case";
import { AvgCaseProcessingTimeWidget } from "../AvgCaseProcessingTimeWidget";

const mockUseWidgetData = vi.fn();

vi.mock("@/hooks/useWidgetData", () => ({
  useWidgetData: (...args: unknown[]) => mockUseWidgetData(...args),
}));

const freshness = {
  lastUpdatedAt: Date.now(),
  isStale: false,
  minutesAgo: 6,
};

const metadata: WidgetMetadata = {
  id: "avg-case-processing-time",
  title: "Avg. Case Processing Time",
};

const activityLog: CaseActivityEntry[] = [];
const cases: CaseDisplay[] = [];

describe("AvgCaseProcessingTimeWidget", () => {
  beforeEach(() => {
    mockUseWidgetData.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders average processing metrics", () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        averageDays: 11,
        medianDays: 10,
        sampleSize: 4,
        previousAverageDays: 9,
        byStatus: { Approved: 8, Denied: 12 },
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(
      <AvgCaseProcessingTimeWidget
        activityLog={activityLog}
        cases={cases}
        metadata={metadata}
      />,
    );

    expect(screen.getByText("Avg. Case Processing Time")).toBeInTheDocument();
    expect(screen.getByText(/11/)).toBeInTheDocument();
    expect(screen.getByText(/Approved/)).toBeInTheDocument();
  });

  it("renders empty state when no sample", () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        averageDays: null,
        medianDays: null,
        sampleSize: 0,
        previousAverageDays: null,
        byStatus: {},
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(
      <AvgCaseProcessingTimeWidget
        activityLog={activityLog}
        cases={cases}
        metadata={metadata}
      />,
    );

    expect(screen.getByText(/no completed cases/i)).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockUseWidgetData.mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed"),
      freshness,
      refresh: vi.fn(),
    });

    render(
      <AvgCaseProcessingTimeWidget
        activityLog={activityLog}
        cases={cases}
        metadata={metadata}
      />,
    );

    expect(screen.getByText(/unable to calculate processing metrics/i)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        averageDays: 12,
        medianDays: 11,
        sampleSize: 6,
        previousAverageDays: 14,
        byStatus: { Approved: 10, Closed: 13 },
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    const { container } = render(
      <AvgCaseProcessingTimeWidget
        activityLog={activityLog}
        cases={cases}
        metadata={metadata}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
