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

  it("renders default messaging and supports retry", async () => {
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

    expect(screen.getByText(/Something went wrong/)).toBeVisible();
    expect(screen.getByText(/Try Again/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /Try Again/i }));
    expect(resetError).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: /Reload Page/i }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("reveals error details in development", async () => {
    const { ErrorFallback } = await import("@/components/error/ErrorFallback");
    render(<ErrorFallback error={new Error("Detailed")}/>);

    const details = screen.getByText(/Error Details/);
    await userEvent.click(details);

    expect(screen.getAllByText(/Detailed/).length).toBeGreaterThan(0);
  });
});

describe("FileSystemErrorFallback", () => {
  it("renders permission guidance for NotAllowedError", async () => {
    const retry = vi.fn();
    const { FileSystemErrorFallback } = await import("@/components/error/ErrorFallback");

    const error = Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });

    render(<FileSystemErrorFallback error={error} onRetry={retry} />);

    expect(screen.getByText(/Permission denied to access the file system/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /Try Again/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
