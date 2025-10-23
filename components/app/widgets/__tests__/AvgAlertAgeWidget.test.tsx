import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WidgetMetadata } from "../WidgetRegistry";
import type { AlertWithMatch } from "@/utils/alertsData";
import { AvgAlertAgeWidget } from "../AvgAlertAgeWidget";

const mockUseWidgetData = vi.fn();

vi.mock("@/hooks/useWidgetData", () => ({
  useWidgetData: (...args: unknown[]) => mockUseWidgetData(...args),
}));

const freshness = {
  lastUpdatedAt: Date.now(),
  isStale: false,
  minutesAgo: 2,
};

const metadata: WidgetMetadata = {
  id: "avg-alert-age",
  title: "Avg. Alert Age",
};

const alerts: AlertWithMatch[] = [];

describe("AvgAlertAgeWidget", () => {
  beforeEach(() => {
    mockUseWidgetData.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders metrics when data is available", () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        averageDays: 12,
        medianDays: 10,
        oldestDays: 42,
        openCount: 3,
        over30Days: 1,
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(<AvgAlertAgeWidget alerts={alerts} metadata={metadata} />);

    expect(screen.getByText("Avg. Alert Age")).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
    expect(screen.getByText(/open alerts counted/i)).toBeInTheDocument();
  });

  it("renders empty state when no open alerts", () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        averageDays: null,
        medianDays: null,
        oldestDays: null,
        openCount: 0,
        over30Days: 0,
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(<AvgAlertAgeWidget alerts={alerts} metadata={metadata} />);

    expect(screen.getByText(/all alerts are cleared/i)).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockUseWidgetData.mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed"),
      freshness,
      refresh: vi.fn(),
    });

    render(<AvgAlertAgeWidget alerts={alerts} metadata={metadata} />);

    expect(screen.getByText(/unable to load alert age metrics/i)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    mockUseWidgetData.mockReturnValue({
      data: {
        averageDays: 5,
        medianDays: 4,
        oldestDays: 12,
        openCount: 2,
        over30Days: 0,
      },
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    const { container } = render(<AvgAlertAgeWidget alerts={alerts} metadata={metadata} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
