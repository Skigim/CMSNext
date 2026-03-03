import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KeyboardShortcutsPanel } from "@/components/settings/KeyboardShortcutsPanel";
import { axe, toHaveNoViolations } from "jest-axe";
import type { ShortcutConfig } from "@/types/keyboardShortcuts";

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  RotateCcw: () => <div data-testid="icon-refresh" />,
  Pencil: () => <div data-testid="icon-pencil" />,
}));

// Mock the util implementations with typed mocks
const mockGetShortcutConfig = vi.fn<() => ShortcutConfig>();
const mockUpdateShortcutBinding = vi.fn<(id: string, binding: string | null) => void>();
const mockToggleShortcut = vi.fn<(id: string, enabled: boolean) => void>();

vi.mock("@/utils/shortcutStorage", () => ({
  getShortcutConfig: () => mockGetShortcutConfig(),
  updateShortcutBinding: (id: string, binding: string | null) => mockUpdateShortcutBinding(id, binding),
  toggleShortcut: (id: string, enabled: boolean) => mockToggleShortcut(id, enabled),
}));

// We need to mock resolveShortcuts because we just mocked the config return value
// Actually, it's probably better to let it use the real resolveShortcuts but mock the config.
vi.mock("@/utils/keyboardShortcuts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/keyboardShortcuts")>();
  return {
    ...actual,
    resolveShortcuts: vi.fn(() => [
      {
        id: "nav-home",
        label: "Home",
        description: "Go to home",
        category: "navigation",
        defaultBinding: "ctrl+h",
        binding: "ctrl+h",
        enabled: true,
      },
    ]),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("KeyboardShortcutsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetShortcutConfig.mockReturnValue({ shortcuts: {} });
  });

  it("renders correctly", () => {
    render(<KeyboardShortcutsPanel />);
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<KeyboardShortcutsPanel />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders shortcut groups", () => {
    render(<KeyboardShortcutsPanel />);
    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("opens the shortcut editor popover and can toggle chord mode", async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcutsPanel />);
    
    // Find the edit button via its role and aria-label
    const editButton = screen.getByRole("button", { name: /Edit Home shortcut/i });
    
    // Click edit
    await user.click(editButton);
    
    // Ensure the popover opened
    await screen.findByText("Edit Shortcut");
    
    // Toggle the chord mode switch
    const chordToggle = screen.getByRole("switch", { name: /Record as two-step chord/i });
    expect(chordToggle).not.toBeChecked();
    
    await user.click(chordToggle);
    expect(chordToggle).toBeChecked();
    
    // Attempt shortcut keydown
    fireEvent.keyDown(document, { key: "g", ctrlKey: true });
    
    // It should now show the arrow meaning it awaits second key
    expect(await screen.findByText("→")).toBeInTheDocument();
    expect(screen.getByText("Press second key...")).toBeInTheDocument();
    
    // Complete the chord
    fireEvent.keyDown(document, { key: "d", ctrlKey: false });
    
    // The visual tokens should render
    // wait for DOM to update
    await waitFor(() => {
      expect(screen.queryByText("Press second key...")).not.toBeInTheDocument();
    });

    // We should now see the finalized binding text
    expect(screen.getByText("D")).toBeInTheDocument();

    // The Save button should be enabled and clicked
    const saveButton = screen.getByRole("button", { name: /Save/i });
    expect(saveButton).not.toBeDisabled();
    
    await user.click(saveButton);
    
    expect(mockUpdateShortcutBinding).toHaveBeenCalledWith("nav-home", "ctrl+g d");
  });
});
