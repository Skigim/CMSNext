import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WidgetMetadata } from "../WidgetRegistry";
import type { AlertWithMatch } from "@/utils/alertsData";
import { AlertsByDescriptionWidget } from "../AlertsByDescriptionWidget";

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
  id: "total-alerts-by-description",
  title: "Alerts by Description",
};

const alerts: AlertWithMatch[] = [];

describe("AlertsByDescriptionWidget", () => {
  beforeEach(() => {
    mockUseWidgetData.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders top alert descriptions", () => {
    mockUseWidgetData.mockReturnValue({
      data: [
        { description: "Income mismatch", count: 5, percentage: 50, openCount: 3, resolvedCount: 2 },
        { description: "Missing assets", count: 3, percentage: 30, openCount: 1, resolvedCount: 2 },
      ],
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(<AlertsByDescriptionWidget alerts={alerts} metadata={metadata} />);

    expect(screen.getByText("Income mismatch")).toBeInTheDocument();
    expect(screen.getByText(/5 • 50.0%/i)).toBeInTheDocument();
  });

  it("allows expanding to show all results", () => {
    const items = Array.from({ length: 12 }).map((_, index) => ({
      description: `Alert ${index + 1}`,
      count: 1,
      percentage: (1 / 12) * 100,
      openCount: 1,
      resolvedCount: 0,
    }));

    mockUseWidgetData.mockReturnValue({
      data: items,
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(<AlertsByDescriptionWidget alerts={alerts} metadata={metadata} />);

    const button = screen.getByRole("button", { name: /show all 12/i });
    fireEvent.click(button);
    expect(screen.getByText("Alert 12")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    mockUseWidgetData.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(<AlertsByDescriptionWidget alerts={alerts} metadata={metadata} />);

    expect(screen.getByText(/no alerts available/i)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    mockUseWidgetData.mockReturnValue({
      data: [
        { description: "Income mismatch", count: 5, percentage: 50, openCount: 3, resolvedCount: 2 },
        { description: "Missing assets", count: 5, percentage: 50, openCount: 2, resolvedCount: 3 },
      ],
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    const { container } = render(<AlertsByDescriptionWidget alerts={alerts} metadata={metadata} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
