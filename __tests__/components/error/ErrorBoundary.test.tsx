import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "@/components/error/ErrorBoundary";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/utils/errorReporting", () => ({
  errorReporting: {
    reportError: vi.fn(),
  },
}));

function ThrowError(): never {
  throw new Error("Test error for ErrorBoundary");
}

describe("ErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders children when no error is thrown", () => {
    // ARRANGE
    render(
      <ErrorBoundary>
        <div>Healthy child</div>
      </ErrorBoundary>,
    );

    // ASSERT
    expect(screen.getByText("Healthy child")).toBeInTheDocument();
  });

  it("renders the fallback UI when a child throws", () => {
    // ARRANGE
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    // ASSERT
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload Page" })).toBeInTheDocument();
    expect(screen.getByText("Unexpected application error")).toBeInTheDocument();
  });

  it("has no accessibility violations for the fallback UI", async () => {
    // ARRANGE
    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    // ACT
    const results = await axe(container);

    // ASSERT
    expect(results).toHaveNoViolations();
  });
});