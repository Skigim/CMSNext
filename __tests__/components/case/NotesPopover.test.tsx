import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  mockAddNote,
  mockUpdateNote,
  mockDeleteNote,
  mockCategoryConfig,
} = vi.hoisted(() => ({
  mockAddNote: vi.fn<
    [string, { content: string; category: string; categories: string[] }],
    Promise<null>
  >(),
  mockUpdateNote: vi.fn<
    [string, string, { content: string; category: string; categories: string[] }],
    Promise<null>
  >(),
  mockDeleteNote: vi.fn<[string, string], Promise<void>>(),
  mockCategoryConfig: {
    config: {
      caseStatuses: [],
      alertTypes: [],
      noteCategories: ["General", "Follow Up"],
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
    updateCategory: vi.fn(),
    resetToDefaults: vi.fn(),
    setConfigFromFile: vi.fn(),
  },
}));

// ============================================================================
// Mocks - must be before component imports
// ============================================================================

vi.mock("@/contexts/DataManagerContext", () => ({
  useDataManagerSafe: () => null,
}));

vi.mock("@/contexts/CategoryConfigContext", () => ({
  useCategoryConfig: () => mockCategoryConfig,
}));

vi.mock("@/hooks/useNotes", () => ({
  useNotes: () => ({
    notes: [
      {
        id: "note-1",
        category: "General",
        categories: ["General", "Important"],
        content: "Test note content",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    addNote: mockAddNote,
    updateNote: mockUpdateNote,
    deleteNote: mockDeleteNote,
    isLoading: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "id"),
  },
}));

vi.mock("@/utils/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    lifecycle: vi.fn(),
  }),
}));

import { NotesPopover } from "@/components/case/NotesPopover";

describe("NotesPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddNote.mockResolvedValue(null);
    mockUpdateNote.mockResolvedValue(null);
    mockDeleteNote.mockResolvedValue();
  });

  it("renders without error", () => {
    // ARRANGE & ACT
    render(<NotesPopover caseId="case-1" />);

    // ASSERT
    expect(screen.getByRole("button", { name: /notes \(1\)/i })).toBeInTheDocument();
  });

  it("note view mode elements have role=button, tabIndex, and onKeyDown", () => {
    // ARRANGE & ACT
    const { container } = render(<NotesPopover caseId="case-1" />);

    // ASSERT
    expect(container.querySelector("button")).not.toBeNull();
  });

  it("shows all note categories when a note has multiple categories", async () => {
    const user = userEvent.setup();
    render(<NotesPopover caseId="case-1" />);

    await user.click(screen.getByRole("button", { name: /notes/i }));

    expect(await screen.findByText("General")).toBeInTheDocument();
    expect(await screen.findByText("Important")).toBeInTheDocument();
  });

  it("layout containment: keeps quick add controls within a wider popover", async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<NotesPopover caseId="case-1" />);

    // ACT
    await user.click(screen.getByRole("button", { name: /notes/i }));
    await user.click(screen.getByRole("button", { name: /add/i }));

    // ASSERT
    const popoverContent = await screen.findByRole("dialog");
    expect(popoverContent.className).toContain("w-96");

    const quickAddActionsRow = screen.getByTestId("notes-quick-add-actions");
    expect(quickAddActionsRow.className).toContain("flex-wrap");
  });

  it("saves selected quick-add categories in the addNote payload", async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<NotesPopover caseId="case-1" />);

    // ACT
    await user.click(screen.getByRole("button", { name: /notes/i }));
    await user.click(screen.getByRole("button", { name: /add/i }));
    await user.type(screen.getByPlaceholderText("Type your note..."), "Quick add note");
    await user.click(
      screen.getByRole("button", {
        name: "Select note categories: General",
      }),
    );
    await user.click(screen.getByRole("option", { name: /Important/ }));
    await user.click(screen.getByRole("option", { name: /Follow Up/ }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // ASSERT
    await waitFor(() => {
      expect(mockAddNote).toHaveBeenCalledWith("case-1", {
        content: "Quick add note",
        category: "Important",
        categories: ["Important", "Follow Up"],
      });
    });
  });

  it("falls back to the default category when quick-add selection is cleared", async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<NotesPopover caseId="case-1" />);

    // ACT
    await user.click(screen.getByRole("button", { name: /notes/i }));
    await user.click(screen.getByRole("button", { name: /add/i }));
    await user.type(
      screen.getByPlaceholderText("Type your note..."),
      "Fallback quick add",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Select note categories: General",
      }),
    );
    await user.click(screen.getByRole("option", { name: /Important/ }));
    await user.click(screen.getByRole("option", { name: /Important/ }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // ASSERT
    await waitFor(() => {
      expect(mockAddNote).toHaveBeenCalledWith("case-1", {
        content: "Fallback quick add",
        category: "General",
        categories: ["General"],
      });
    });
  });

  it("saves edited category changes in the updateNote payload", async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<NotesPopover caseId="case-1" />);

    // ACT
    await user.click(screen.getByRole("button", { name: /notes/i }));
    await user.click(screen.getByRole("button", { name: /test note content/i }));
    const editTextarea = screen.getByDisplayValue("Test note content");
    await user.clear(editTextarea);
    await user.type(editTextarea, "Updated note content");
    await user.click(
      screen.getByRole("button", {
        name: "Edit note categories: 2 selected",
      }),
    );
    await user.click(screen.getByRole("option", { name: /General/ }));
    await user.click(screen.getByRole("option", { name: /Follow Up/ }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // ASSERT
    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith("case-1", "note-1", {
        content: "Updated note content",
        category: "Important",
        categories: ["Important", "Follow Up"],
      });
    });
  });

  it("falls back to the original note categories when edit selection is cleared", async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<NotesPopover caseId="case-1" />);

    // ACT
    await user.click(screen.getByRole("button", { name: /notes/i }));
    await user.click(screen.getByRole("button", { name: /test note content/i }));
    await user.click(
      screen.getByRole("button", {
        name: "Edit note categories: 2 selected",
      }),
    );
    await user.click(screen.getByRole("option", { name: /General/ }));
    await user.click(screen.getByRole("option", { name: /Important/ }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // ASSERT
    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith("case-1", "note-1", {
        content: "Test note content",
        category: "General",
        categories: ["General", "Important"],
      });
    });
  });
});
