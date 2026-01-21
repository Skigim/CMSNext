import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WidgetMetadata } from "../WidgetRegistry";
import type { StoredCase } from "@/types/case";
import type { AlertsIndex } from "@/utils/alertsData";
import type { CaseActivityEntry } from "@/types/activityLog";
import { DailyStatsWidget } from "../DailyStatsWidget";

const mockUseWidgetData = vi.fn();

vi.mock("@/hooks/useWidgetData", () => ({
  useWidgetData: (...args: unknown[]) => mockUseWidgetData(...args),
}));

const freshness = {
  lastUpdatedAt: Date.now(),
  isStale: false,
  minutesAgo: 4,
};

const metadata: WidgetMetadata = {
  id: "daily-stats",
  title: "Daily Overview",
};

const alertsIndex: AlertsIndex = {
  alerts: [],
  summary: {
    total: 0,
    matched: 0,
    unmatched: 0,
    missingMcn: 0,
    latestUpdated: null,
  },
  alertsByCaseId: new Map(),
  unmatched: [],
  missingMcn: [],
};

const cases: StoredCase[] = [];
const activityLog: CaseActivityEntry[] = [];

describe("DailyStatsWidget", () => {
  beforeEach(() => {
    mockUseWidgetData.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders daily overview metrics", () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        averagePriority: 320,
        activeCases: 4,
        processedToday: 3,
        alertsClearedToday: 2,
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(
      <DailyStatsWidget
        cases={cases}
        alerts={alertsIndex}
        activityLog={activityLog}
        metadata={metadata}
      />,
    );

    expect(screen.getByText("Daily Overview")).toBeInTheDocument();
    expect(screen.getByText(/4 active/i)).toBeInTheDocument();
    expect(screen.getByText("320")).toBeInTheDocument();
    expect(screen.getByText(/processed today/i)).toBeInTheDocument();
    expect(screen.getByText(/alerts cleared/i)).toBeInTheDocument();
  });

  it("renders empty state messaging", () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        averagePriority: null,
        activeCases: 0,
        processedToday: 0,
        alertsClearedToday: 0,
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(
      <DailyStatsWidget
        cases={cases}
        alerts={alertsIndex}
        activityLog={activityLog}
        metadata={metadata}
      />,
    );

    expect(screen.getByText(/no active cases/i)).toBeInTheDocument();
    expect(screen.getByText(/no active cases to score/i)).toBeInTheDocument();
    expect(screen.getByText(/no updates recorded today/i)).toBeInTheDocument();
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
      <DailyStatsWidget
        cases={cases}
        alerts={alertsIndex}
        activityLog={activityLog}
        metadata={metadata}
      />,
    );

    expect(screen.getByText(/unable to load daily stats/i)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        averagePriority: 225,
        activeCases: 2,
        processedToday: 1,
        alertsClearedToday: 1,
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    const { container } = render(
      <DailyStatsWidget
        cases={cases}
        alerts={alertsIndex}
        activityLog={activityLog}
        metadata={metadata}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
