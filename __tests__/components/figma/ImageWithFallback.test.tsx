import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const TEST_SRC = "https://example.com/image.png";

describe("ImageWithFallback", () => {
  it("renders the provided image initially with loading skeleton", async () => {
    const { ImageWithFallback } = await import("@/components/figma/ImageWithFallback");

    render(<ImageWithFallback src={TEST_SRC} alt="Sample" data-testid="preview" />);

    const img = screen.getByTestId("preview");
    expect(img).toHaveAttribute("src", TEST_SRC);
    expect(img).toHaveAttribute("alt", "Sample");
  });

  it("removes skeleton when image loads", async () => {
    const { ImageWithFallback } = await import("@/components/figma/ImageWithFallback");

    render(<ImageWithFallback src={TEST_SRC} alt="Sample" data-testid="preview" />);

    const img = screen.getByTestId("preview") as HTMLImageElement;
    
    // Simulate image load
    fireEvent.load(img);
    
    // Image should be visible (not hidden by the isLoading check)
    expect(img).not.toHaveClass("hidden");
  });

  it("shows fallback when the image errors", async () => {
    const { ImageWithFallback } = await import("@/components/figma/ImageWithFallback");

    render(<ImageWithFallback src={TEST_SRC} alt="Sample" data-testid="preview" />);

    const original = screen.getByTestId("preview");
    fireEvent.error(original);

    // Wait for the fallback UI to render with the ImageOff icon
    await waitFor(() => {
      // The IconOff SVG has aria-hidden="true" so we check for the class
      const svg = document.querySelector(".lucide-image-off");
      expect(svg).toBeInTheDocument();
    });
  });

  it("displays error message with alt text in fallback", async () => {
    const { ImageWithFallback } = await import("@/components/figma/ImageWithFallback");

    render(<ImageWithFallback src={TEST_SRC} alt="My Image" data-testid="preview" />);

    const original = screen.getByTestId("preview");
    fireEvent.error(original);

    // The alt text should be displayed in the fallback UI
    await waitFor(() => {
      expect(screen.getByText("My Image")).toBeInTheDocument();
    });
  });

  it("respects custom aspectRatio prop", async () => {
    const { ImageWithFallback } = await import("@/components/figma/ImageWithFallback");

    const { container } = render(
      <ImageWithFallback 
        src={TEST_SRC} 
        alt="Sample" 
        data-testid="preview" 
        aspectRatio={4 / 3}
      />
    );

    const aspectRatioElement = container.querySelector('[data-slot="aspect-ratio"]');
    expect(aspectRatioElement).toBeInTheDocument();
  });
});
