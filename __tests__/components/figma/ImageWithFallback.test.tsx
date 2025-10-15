import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const TEST_SRC = "https://example.com/image.png";

describe("ImageWithFallback", () => {
  it("renders the provided image initially", async () => {
    const { ImageWithFallback } = await import("@/components/figma/ImageWithFallback");

    render(<ImageWithFallback src={TEST_SRC} alt="Sample" data-testid="preview" />);

    const img = screen.getByTestId("preview");
    expect(img).toHaveAttribute("src", TEST_SRC);
    expect(img).toHaveAttribute("alt", "Sample");
  });

  it("shows fallback when the image errors", async () => {
    const { ImageWithFallback } = await import("@/components/figma/ImageWithFallback");

    render(<ImageWithFallback src={TEST_SRC} alt="Sample" data-testid="preview" />);

    const original = screen.getByTestId("preview");
    fireEvent.error(original);

    const fallback = screen.getByAltText("Error loading image");
    expect(fallback).toBeVisible();
    expect(fallback).toHaveAttribute("data-original-url", TEST_SRC);
  });
});
