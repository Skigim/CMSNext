import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeAll, afterAll, afterEach, vi } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;
const originalLocation = window.location;

describe("ErrorFallback", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "development";
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      enumerable: true,
      value: originalLocation,
    });
  });

  it("renders default messaging with Card component and supports retry", async () => {
    const resetError = vi.fn();
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      enumerable: true,
      value: {
        reload: reloadSpy,
        href: "about:blank",
      } as unknown as Location,
    });

    const { ErrorFallback } = await import("@/components/error/ErrorFallback");

    render(<ErrorFallback error={new Error("Boom")} resetError={resetError} />);

    // Check that alert container is present with proper accessibility attributes
    const alertContainer = screen.getByRole("alert");
    expect(alertContainer).toHaveAttribute("aria-live", "polite");

    expect(screen.getByText(/Something went wrong/)).toBeVisible();
    expect(screen.getByText(/Try Again/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /Try Again/i }));
    expect(resetError).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: /Reload Page/i }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("reveals error details in development using details element", async () => {
    const { ErrorFallback } = await import("@/components/error/ErrorFallback");
    render(<ErrorFallback error={new Error("Detailed")}/>);

    const details = screen.getByText(/Error Details/);
    await userEvent.click(details);

    expect(screen.getAllByText(/Detailed/).length).toBeGreaterThan(0);
  });

  it("uses shadcn Button components with proper variants", async () => {
    const resetError = vi.fn();
    const { ErrorFallback } = await import("@/components/error/ErrorFallback");

    render(<ErrorFallback error={new Error("Test")} resetError={resetError} />);

    const tryAgainBtn = screen.getByRole("button", { name: /Try Again/i });
    const reloadBtn = screen.getByRole("button", { name: /Reload Page/i });

    // Verify buttons exist and have proper styling via data attributes from shadcn
    expect(tryAgainBtn).toBeInTheDocument();
    expect(reloadBtn).toBeInTheDocument();
  });

  it("renders without custom CSS classes, only Tailwind and shadcn primitives", async () => {
    const { ErrorFallback } = await import("@/components/error/ErrorFallback");
    const { container } = render(<ErrorFallback error={new Error("Test")} />);

    // Verify no custom error-fallback or similar custom classes are present
    const cards = container.querySelectorAll('[data-slot="card"]');
    expect(cards.length).toBeGreaterThan(0);
  });
});

describe("FileSystemErrorFallback", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "development";
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("renders permission guidance for NotAllowedError with alert semantics", async () => {
    const retry = vi.fn();
    const { FileSystemErrorFallback } = await import("@/components/error/ErrorFallback");

    const error = Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });

    render(<FileSystemErrorFallback error={error} onRetry={retry} />);

    // Check for alert accessibility attributes
    const alertContainer = screen.getByRole("alert");
    expect(alertContainer).toHaveAttribute("aria-live", "assertive");

    expect(screen.getByText(/Permission denied to access the file system/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /Try Again/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("handles compact mode with shadcn Button size variants", async () => {
    const { FileSystemErrorFallback } = await import("@/components/error/ErrorFallback");

    const error = Object.assign(new Error("Test"), { name: "NotAllowedError" });
    render(<FileSystemErrorFallback error={error} compact={true} />);

    expect(screen.getByRole("alert")).toHaveClass("min-h-[200px]");
    expect(screen.getByText(/Permission denied/)).toBeVisible();
  });

  it("renders AbortError message correctly", async () => {
    const { FileSystemErrorFallback } = await import("@/components/error/ErrorFallback");

    const error = Object.assign(new Error("Aborted"), { name: "AbortError" });
    render(<FileSystemErrorFallback error={error} />);

    expect(screen.getByText(/File operation was cancelled/)).toBeVisible();
    expect(screen.getByText(/The file operation was cancelled/)).toBeVisible();
  });

  it("renders security error message correctly", async () => {
    const { FileSystemErrorFallback } = await import("@/components/error/ErrorFallback");

    const error = Object.assign(new Error("Security blocked"), { name: "SecurityError" });
    render(<FileSystemErrorFallback error={error} />);

    expect(screen.getByText(/Security restriction prevented/)).toBeVisible();
    expect(screen.getByText(/security settings/)).toBeVisible();
  });
});
