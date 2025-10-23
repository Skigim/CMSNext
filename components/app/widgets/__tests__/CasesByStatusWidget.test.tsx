import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WidgetMetadata } from "../WidgetRegistry";
import type { CaseDisplay } from "@/types/case";
import { CasesByStatusWidget } from "../CasesByStatusWidget";

const mockUseWidgetData = vi.fn();

vi.mock("@/hooks/useWidgetData", () => ({
  useWidgetData: (...args: unknown[]) => mockUseWidgetData(...args),
}));

const freshness = {
  lastUpdatedAt: Date.now(),
  isStale: false,
  minutesAgo: 3,
};

const metadata: WidgetMetadata = {
  id: "total-cases-by-status",
  title: "Total Cases by Status",
};

const cases: CaseDisplay[] = [];

describe("CasesByStatusWidget", () => {
  beforeEach(() => {
    mockUseWidgetData.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders status breakdown", () => {
    mockUseWidgetData.mockReturnValue({
      data: [
        { status: "Pending", count: 4, percentage: 66.6, colorClass: "bg-primary" },
        { status: "Closed", count: 2, percentage: 33.3, colorClass: "bg-muted" },
      ],
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(<CasesByStatusWidget cases={cases} metadata={metadata} />);

    expect(screen.getByText("Total Cases by Status")).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    expect(screen.getByText(/Closed/i)).toBeInTheDocument();
  });

  it("renders empty state when no cases", () => {
    mockUseWidgetData.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    render(<CasesByStatusWidget cases={cases} metadata={metadata} />);

    expect(screen.getByText(/no cases available/i)).toBeInTheDocument();
  });

  it("renders error state", () => {
    mockUseWidgetData.mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed"),
      freshness,
      refresh: vi.fn(),
    });

    render(<CasesByStatusWidget cases={cases} metadata={metadata} />);

    expect(screen.getByText(/unable to compute case distribution/i)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    mockUseWidgetData.mockReturnValue({
      data: [
        { status: "Pending", count: 2, percentage: 50, colorClass: "bg-primary" },
        { status: "Closed", count: 2, percentage: 50, colorClass: "bg-muted" },
      ],
      loading: false,
      error: null,
      freshness,
      refresh: vi.fn(),
    });

    const { container } = render(<CasesByStatusWidget cases={cases} metadata={metadata} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
