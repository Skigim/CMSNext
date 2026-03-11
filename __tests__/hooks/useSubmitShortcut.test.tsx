import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSubmitShortcut } from "@/hooks/useSubmitShortcut";

function ShortcutHarness({
  canSubmit = true,
  onSubmit,
}: Readonly<{
  canSubmit?: boolean;
  onSubmit: () => void | Promise<void>;
}>) {
  const handleSubmitShortcut = useSubmitShortcut<HTMLTextAreaElement>({
    onSubmit,
    canSubmit,
  });

  return <textarea aria-label="Shortcut field" onKeyDown={handleSubmitShortcut} />;
}

describe("useSubmitShortcut", () => {
  it("submits on Ctrl+Enter", () => {
    const onSubmit = vi.fn();

    render(<ShortcutHarness onSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByLabelText("Shortcut field"), {
      key: "Enter",
      ctrlKey: true,
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("submits on Cmd+Enter", () => {
    const onSubmit = vi.fn();

    render(<ShortcutHarness onSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByLabelText("Shortcut field"), {
      key: "Enter",
      metaKey: true,
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not submit on plain Enter", () => {
    const onSubmit = vi.fn();

    render(<ShortcutHarness onSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByLabelText("Shortcut field"), {
      key: "Enter",
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit when disabled", () => {
    const onSubmit = vi.fn();

    render(<ShortcutHarness onSubmit={onSubmit} canSubmit={false} />);

    fireEvent.keyDown(screen.getByLabelText("Shortcut field"), {
      key: "Enter",
      ctrlKey: true,
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
