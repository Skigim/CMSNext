import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WidgetMetadata } from "../WidgetRegistry";
import type { AlertWithMatch } from "@/utils/alertsData";
import { AlertsClearedPerDayWidget } from "../AlertsClearedPerDayWidget";

const mockUseWidgetData = vi.fn();

vi.mock("@/hooks/useWidgetData", () => ({
  useWidgetData: (...args: unknown[]) => mockUseWidgetData(...args),
}));

const freshness = {
  lastUpdatedAt: Date.now(),
  isStale: false,
  minutesAgo: 1,
};

const metadata: WidgetMetadata = {
  id: "alerts-cleared-per-day",
  title: "Alerts Cleared/Day",
};

const alerts: AlertWithMatch[] = [];

describe("AlertsClearedPerDayWidget", () => {
  beforeEach(() => {
    mockUseWidgetData.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders resolution trend", () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        daily: [
          { date: "2025-10-16", clearedCount: 1 },
          { date: "2025-10-17", clearedCount: 0 },
          { date: "2025-10-18", clearedCount: 2 },
        ],
        total: 3,
        previousTotal: 1,
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(<AlertsClearedPerDayWidget alerts={alerts} metadata={metadata} />);

    expect(screen.getByText("Alerts Cleared/Day")).toBeInTheDocument();
    expect(screen.getByText(/3 cleared/)).toBeInTheDocument();
    expect(screen.getByText(/weekly change/i)).toBeInTheDocument();
  });

  it("renders empty state", () => {
    mockUseWidgetData.mockReturnValue({
      data: { daily: [], total: 0, previousTotal: 0 },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(<AlertsClearedPerDayWidget alerts={alerts} metadata={metadata} />);

    expect(screen.getByText(/no alerts cleared/i)).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockUseWidgetData.mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed"),
      freshness,
      refresh: vi.fn(),
    });

    render(<AlertsClearedPerDayWidget alerts={alerts} metadata={metadata} />);

    expect(screen.getByText(/unable to calculate alert resolutions/i)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        daily: [
          { date: "2025-10-16", clearedCount: 1 },
          { date: "2025-10-17", clearedCount: 3 },
          { date: "2025-10-18", clearedCount: 2 },
        ],
        total: 6,
        previousTotal: 5,
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    const { container } = render(<AlertsClearedPerDayWidget alerts={alerts} metadata={metadata} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
