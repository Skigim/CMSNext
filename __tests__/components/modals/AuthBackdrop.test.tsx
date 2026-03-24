import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { AuthBackdrop } from "@/components/modals/AuthBackdrop";

describe("AuthBackdrop", () => {
  it("does not render when closed", () => {
    // Arrange
    const { container } = render(<AuthBackdrop isOpen={false} />);

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a decorative aria-hidden backdrop when open", async () => {
    // Arrange
    const { container } = render(<AuthBackdrop isOpen={true} />);

    // Act
    const results = await axe(container);
    const backdrop = container.querySelector('[data-slot="backdrop"]');
    const layers = container.querySelectorAll('[data-slot="backdrop-layer"]');
    const glow = container.querySelector('[data-slot="backdrop-glow"]');

    // Assert
    expect(results).toHaveNoViolations();
    expect(backdrop).not.toBeNull();
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(layers).toHaveLength(4);
    expect(glow).not.toBeNull();
  });
});