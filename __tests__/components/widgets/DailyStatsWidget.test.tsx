import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DailyStatsWidget } from "@/components/app/widgets/DailyStatsWidget";
import type { WidgetMetadata } from "@/components/app/widgets/WidgetRegistry";
import type { StoredCase } from "@/types/case";
import type { AlertsIndex } from "@/utils/alertsData";
import type { CaseActivityEntry } from "@/types/activityLog";

// Mock useWidgetData hook
const mockUseWidgetData = vi.fn();
vi.mock("@/hooks/useWidgetData", () => ({
  useWidgetData: (...args: unknown[]) => mockUseWidgetData(...args),
}));

// Mock useCategoryConfig
vi.mock("@/contexts/CategoryConfigContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/CategoryConfigContext")>();
  return {
    ...actual,
    useCategoryConfig: () => ({
      config: {
        caseStatuses: [
          { name: "Pending", colorSlot: "blue", countsAsCompleted: false },
          { name: "Approved", colorSlot: "green", countsAsCompleted: true },
          { name: "Denied", colorSlot: "red", countsAsCompleted: true },
        ],
        alertTypes: [],
      },
    }),
  };
});

const freshness = {
  lastUpdatedAt: Date.now(),
  isStale: false,
  minutesAgo: 2,
};

const metadata: WidgetMetadata = {
  id: "daily-stats",
  title: "Daily Stats",
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

  it("renders daily stats metrics", () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        averagePriority: 450,
        activeCaseCount: 5,
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
      />
    );

    expect(screen.getByText("Daily Stats")).toBeInTheDocument();
    expect(screen.getByText("450")).toBeInTheDocument();
    expect(screen.getByText("5 active")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/Avg\. Priority/i)).toBeInTheDocument();
    expect(screen.getByText(/Processed/i)).toBeInTheDocument();
    expect(screen.getByText(/Alerts Cleared/i)).toBeInTheDocument();
  });

  it("renders empty state when no activity today", () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        averagePriority: 200,
        activeCaseCount: 2,
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
      />
    );

    expect(screen.getByText("No activity recorded today")).toBeInTheDocument();
  });

  it("renders loading state with skeleton", () => {
    mockUseWidgetData.mockReturnValue({
      data: null,
      loading: true,
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
      />
    );

    expect(screen.getByText("Daily Stats")).toBeInTheDocument();
    expect(screen.getByText("Loading today's metrics...")).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockUseWidgetData.mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed to load"),
      freshness,
      refresh: vi.fn(),
    });

    render(
      <DailyStatsWidget
        cases={cases}
        alerts={alertsIndex}
        activityLog={activityLog}
        metadata={metadata}
      />
    );

    expect(screen.getByText("Unable to load daily stats")).toBeInTheDocument();
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("renders placeholder when no active cases", () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        averagePriority: null,
        activeCaseCount: 0,
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
      />
    );

    expect(screen.getByText("--")).toBeInTheDocument();
    // "No active cases" appears in both badge and metric description
    expect(screen.getAllByText("No active cases")).toHaveLength(2);
  });

  it("has no accessibility violations", async () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        averagePriority: 300,
        activeCaseCount: 3,
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
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
