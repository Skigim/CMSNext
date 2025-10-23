import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyableText } from "@/components/common/CopyableText";
import * as clipboardModule from "@/utils/clipboard";

describe("CopyableText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders text with copy button when text is provided", () => {
      render(<CopyableText text="test@example.com" label="Email" />);
      
      expect(screen.getByText("Email:")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /copy email/i })).toBeInTheDocument();
    });

    it("renders missing label when text is not provided", () => {
      render(<CopyableText text={null} label="Phone" missingLabel="No phone" />);
      
      expect(screen.getByText("Phone:")).toBeInTheDocument();
      expect(screen.getByText("No phone")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("hides label when showLabel is false", () => {
      render(<CopyableText text="123-456-7890" label="Phone" showLabel={false} />);
      
      expect(screen.queryByText("Phone:")).not.toBeInTheDocument();
      // Check that the button with the text exists (there will be multiple, one sr-only)
      expect(screen.getByRole("button", { name: /copy phone/i })).toBeInTheDocument();
    });

    it("uses default missing label when not provided", () => {
      render(<CopyableText text={null} label="Contact" />);
      
      expect(screen.getByText("Not provided")).toBeInTheDocument();
    });
  });

  describe("copy functionality", () => {
    it("calls clickToCopy when button is clicked", async () => {
      const user = userEvent.setup();
      const clickToCopySpy = vi.spyOn(clipboardModule, "clickToCopy").mockResolvedValue(true);
      
      render(<CopyableText text="test@example.com" label="Email" />);
      
      const copyButton = screen.getByRole("button", { name: /copy email/i });
      await user.click(copyButton);
      
      expect(clickToCopySpy).toHaveBeenCalledWith("test@example.com", {
        successMessage: "Email copied to clipboard",
      });
    });

    it("uses custom success message when provided", async () => {
      const user = userEvent.setup();
      const clickToCopySpy = vi.spyOn(clipboardModule, "clickToCopy").mockResolvedValue(true);
      
      render(
        <CopyableText
          text="123-456-7890"
          label="Phone"
          successMessage="Phone number copied!"
        />
      );
      
      const copyButton = screen.getByRole("button", { name: /copy phone/i });
      await user.click(copyButton);
      
      expect(clickToCopySpy).toHaveBeenCalledWith("123-456-7890", {
        successMessage: "Phone number copied!",
      });
    });

    it("does nothing when copy button is clicked with no text", async () => {
      const clickToCopySpy = vi.spyOn(clipboardModule, "clickToCopy");
      
      render(<CopyableText text={null} label="Email" />);
      
      // There should be no button when text is null
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(clickToCopySpy).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("provides accessible labels for screen readers", () => {
      render(<CopyableText text="test@example.com" label="Email" />);
      
      // The label should be accessible via screen reader
      expect(screen.getByText("Email:", { selector: "[aria-hidden]" })).toBeInTheDocument();
      expect(screen.getByText("Email: test@example.com", { selector: ".sr-only" })).toBeInTheDocument();
    });

    it("provides accessible missing label for screen readers", () => {
      render(<CopyableText text={null} label="Phone" missingLabel="No phone" />);
      
      expect(screen.getByText("Phone: No phone", { selector: ".sr-only" })).toBeInTheDocument();
    });

    it("has appropriate aria-label on copy button", () => {
      render(<CopyableText text="test@example.com" label="Email" />);
      
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", "Copy Email test@example.com");
    });

    it("uses custom aria-label when provided", () => {
      render(
        <CopyableText
          text="test@example.com"
          label="Email"
          ariaLabel="Copy email address to clipboard"
        />
      );
      
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", "Copy email address to clipboard");
    });
  });

  describe("styling", () => {
    it("applies custom className to wrapper", () => {
      const { container } = render(
        <CopyableText text="test@example.com" label="Email" className="custom-wrapper" />
      );
      
      expect(container.querySelector(".custom-wrapper")).toBeInTheDocument();
    });

    it("applies custom buttonClassName to button", () => {
      render(
        <CopyableText text="test@example.com" label="Email" buttonClassName="custom-button" />
      );
      
      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-button");
    });
  });
});
