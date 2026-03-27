import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { useNotes } from "@/hooks/useNotes";

type UseNotesResult = ReturnType<typeof useNotes>;
type AddNoteMock = UseNotesResult["addNote"];
type UpdateNoteMock = UseNotesResult["updateNote"];
type DeleteNoteMock = UseNotesResult["deleteNote"];

const {
  mockAddNote,
  mockUpdateNote,
  mockDeleteNote,
  mockCategoryConfig,
  mockClickToCopy,
} = vi.hoisted(() => ({
  mockAddNote: vi.fn<AddNoteMock>(),
  mockUpdateNote: vi.fn<UpdateNoteMock>(),
  mockDeleteNote: vi.fn<DeleteNoteMock>(),
  mockClickToCopy: vi.fn<(text: string, options?: unknown) => Promise<boolean>>(),
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

vi.mock("@/utils/clipboard", () => ({
  clickToCopy: mockClickToCopy,
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

function renderNotesPopover() {
  return render(<NotesPopover caseId="case-1" />);
}

async function openNotesPopover(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /notes/i }));
}

async function openQuickAdd(user: ReturnType<typeof userEvent.setup>) {
  await openNotesPopover(user);
  await user.click(screen.getByRole("button", { name: /add/i }));
}

async function openEditMode(user: ReturnType<typeof userEvent.setup>) {
  await openNotesPopover(user);
  await user.click(screen.getByRole("button", { name: /test note content/i }));
}

async function setupQuickAdd() {
  const user = userEvent.setup();
  renderNotesPopover();
  await openQuickAdd(user);
  return { user };
}

async function setupEditModeScenario() {
  const user = userEvent.setup();
  renderNotesPopover();
  await openEditMode(user);
  return { user };
}

async function selectCategories(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: string,
  optionNames: string[],
) {
  await user.click(
    screen.getByRole("button", {
      name: triggerName,
    }),
  );

  for (const optionName of optionNames) {
    await user.click(screen.getByRole("option", { name: new RegExp(optionName, "i") }));
  }
}

describe("NotesPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddNote.mockResolvedValue(null);
    mockUpdateNote.mockResolvedValue(null);
    mockDeleteNote.mockResolvedValue(undefined);
    mockClickToCopy.mockResolvedValue(true);
  });

  it("renders the notes trigger button with the note count", () => {
    // ARRANGE & ACT
    renderNotesPopover();

    // ASSERT
    expect(screen.getByRole("button", { name: /notes \(1\)/i })).toBeInTheDocument();
  });

  it("renders note content as an interactive button in view mode", async () => {
    // ARRANGE
    const user = userEvent.setup();
    renderNotesPopover();

    // ACT
    await openNotesPopover(user);

    // ASSERT
    expect(screen.getByRole("button", { name: /test note content/i })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("shows all note categories when a note has multiple categories", async () => {
    // ARRANGE
    const user = userEvent.setup();
    renderNotesPopover();

    // ACT
    await openNotesPopover(user);

    // ASSERT
    expect(await screen.findByText("General")).toBeInTheDocument();
    expect(await screen.findByText("Important")).toBeInTheDocument();
  });

  it("layout containment: keeps quick add controls within a wider popover", async () => {
    // ARRANGE
    const user = userEvent.setup();
    renderNotesPopover();

    // ACT
    await openQuickAdd(user);

    // ASSERT
    const popoverContent = await screen.findByRole("dialog");
    expect(popoverContent.className).toContain("w-96");

    const quickAddActionsRow = screen.getByTestId("notes-quick-add-actions");
    expect(quickAddActionsRow.className).toContain("flex-wrap");
  });

  it("shows a success toast when a note is copied", async () => {
    // ARRANGE
    const user = userEvent.setup();
    renderNotesPopover();

    // ACT
    await openNotesPopover(user);
    await user.click(screen.getByRole("button", { name: /copy note/i }));

    // ASSERT
    await waitFor(() => {
      expect(mockClickToCopy).toHaveBeenCalledWith("Test note content", {
        successMessage: "Note copied to clipboard",
      });
    });
  });

  it.each([
    {
      name: "saves selected quick-add categories in the addNote payload",
      content: "Quick add note",
      optionNames: ["Important", "Follow Up"],
      expectedPayload: {
        content: "Quick add note",
        category: "Important",
        categories: ["Important", "Follow Up"],
      },
    },
    {
      name: "falls back to the default category when quick-add selection is cleared",
      content: "Fallback quick add",
      optionNames: ["Important", "Important"],
      expectedPayload: {
        content: "Fallback quick add",
        category: "General",
        categories: ["General"],
      },
    },
  ])("$name", async ({ content, optionNames, expectedPayload }) => {
    // ARRANGE
    const { user } = await setupQuickAdd();

    // ACT
    await user.type(screen.getByPlaceholderText("Type your note..."), content);
    await selectCategories(user, "Select note categories: General", optionNames);
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // ASSERT
    await waitFor(() => {
      expect(mockAddNote).toHaveBeenCalledWith("case-1", expectedPayload);
    });
  });

  it.each([
    {
      name: "saves edited category changes in the updateNote payload",
      updatedContent: "Updated note content",
      optionNames: ["General", "Follow Up"],
      expectedPayload: {
        content: "Updated note content",
        category: "Important",
        categories: ["Important", "Follow Up"],
      },
    },
    {
      name: "falls back to the original note categories when edit selection is cleared",
      updatedContent: null,
      optionNames: ["General", "Important"],
      expectedPayload: {
        content: "Test note content",
        category: "General",
        categories: ["General", "Important"],
      },
    },
  ])("$name", async ({ updatedContent, optionNames, expectedPayload }) => {
    // ARRANGE
    const { user } = await setupEditModeScenario();

    // ACT
    if (updatedContent !== null) {
      const editTextarea = screen.getByDisplayValue("Test note content");
      await user.clear(editTextarea);
      await user.type(editTextarea, updatedContent);
    }
    await selectCategories(user, "Edit note categories: 2 selected", optionNames);
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    // ASSERT
    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith("case-1", "note-1", expectedPayload);
    });
  });
});
