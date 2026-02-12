import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CopyButton } from "@/components/common/CopyButton";

// Mock the clipboard utility
vi.mock("@/utils/clipboard", () => ({
  clickToCopy: vi.fn(),
}));

import { clickToCopy } from "@/utils/clipboard";

describe("CopyButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the value", () => {
    render(<CopyButton value="Test content" label="test" />);
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders displayText when provided", () => {
    render(
      <CopyButton value="raw-value" displayText="Formatted Value" label="test" />
    );
    expect(screen.getByText("Formatted Value")).toBeInTheDocument();
    expect(screen.queryByText("raw-value")).not.toBeInTheDocument();
  });

  it("calls clickToCopy with value when clicked", async () => {
    const user = userEvent.setup();
    render(<CopyButton value="Copy me" label="Test Value" />);

    await user.click(screen.getByText("Copy me"));

    expect(clickToCopy).toHaveBeenCalledWith("Copy me", {
      successMessage: "Test Value copied to clipboard",
    });
  });

  it("copies raw value even when displayText differs", async () => {
    const user = userEvent.setup();
    render(
      <CopyButton
        value="raw-value"
        displayText="Pretty Display"
        label="Field"
      />
    );

    await user.click(screen.getByText("Pretty Display"));

    expect(clickToCopy).toHaveBeenCalledWith("raw-value", {
      successMessage: "Field copied to clipboard",
    });
  });

  it("has accessible button role", () => {
    render(<CopyButton value="Accessible" label="test" />);
    expect(
      screen.getByRole("button", { name: /copy test/i })
    ).toBeInTheDocument();
  });

  it("applies monospace styling when mono prop is true", () => {
    render(<CopyButton value="MCN123" label="mcn" mono />);
    // Mono class is on the span inside the button, not the button itself
    expect(screen.getByText("MCN123").className).toMatch(/font-mono/);
  });

  it("applies muted variant styling by default", () => {
    render(<CopyButton value="test" label="test" />);
    const button = screen.getByRole("button");
    // Muted variant has bg-muted styling
    expect(button.className).toMatch(/bg-muted/);
  });

  it("applies plain variant styling when specified", () => {
    render(<CopyButton value="test" label="test" variant="plain" />);
    const button = screen.getByRole("button");
    // Plain variant doesn't have bg-muted
    expect(button.className).not.toMatch(/bg-muted(?:\s|$)/);
  });

  it("respects interactive prop for hover styling", () => {
    const { rerender } = render(
      <CopyButton value="test" label="test" interactive />
    );
    const interactiveButton = screen.getByRole("button");
    expect(interactiveButton.className).toMatch(/hover:/);

    rerender(<CopyButton value="test" label="test" interactive={false} />);
    const nonInteractiveButton = screen.getByRole("button");
    // Interactive buttons include hover:translate effects
    expect(nonInteractiveButton.className).not.toMatch(/hover:-translate/);
  });

  it("renders missing label when value is null", () => {
    render(<CopyButton value={null} label="Test" missingLabel="N/A" />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("uses custom success message when provided", async () => {
    const user = userEvent.setup();
    render(
      <CopyButton
        value="test"
        label="Test"
        successMessage="Custom toast message"
      />
    );

    await user.click(screen.getByText("test"));

    expect(clickToCopy).toHaveBeenCalledWith("test", {
      successMessage: "Custom toast message",
    });
  });
});
