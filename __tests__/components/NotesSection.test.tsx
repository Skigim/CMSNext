import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { createMockNote } from "@/src/test/testUtils";
import { mergeCategoryConfig } from "@/types/categoryConfig";

const categoryConfigMock = mergeCategoryConfig();

vi.mock("@/contexts/CategoryConfigContext", () => ({
  useCategoryConfig: () => ({
    config: categoryConfigMock,
    loading: false,
    error: null,
    refresh: vi.fn(),
    updateCategory: vi.fn(),
    resetToDefaults: vi.fn(),
    setConfigFromFile: vi.fn(),
  }),
}));

import { NotesSection } from "@/components/case/NotesSection";

afterEach(() => {
  vi.clearAllMocks();
});

describe("NotesSection", () => {
  it("renders existing notes and calls fallback add handler when creation API is unavailable", async () => {
    const user = userEvent.setup();
    const note = createMockNote({ content: "First note" });
    const onAddNote = vi.fn();
    const onEditNote = vi.fn();
    const onDeleteNote = vi.fn();

    render(
      <NotesSection
        notes={[note]}
        onAddNote={onAddNote}
        onEditNote={onEditNote}
        onDeleteNote={onDeleteNote}
      />
    );

    expect(screen.getByText(/notes/i)).toBeInTheDocument();
    const countBadge = screen.getByText((content, element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      return (
        element.tagName === "SPAN" &&
        element.dataset.slot === "badge" &&
        content.trim() === "1"
      );
    });
    expect(countBadge).toBeInTheDocument();
    expect(screen.getByText(/first note/i, { selector: "p" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add note/i }));
    expect(onAddNote).toHaveBeenCalledTimes(1);
  });

  it("allows creating a new note via skeleton workflow when create handler is provided", async () => {
    const user = userEvent.setup();
    const onAddNote = vi.fn();
    const onEditNote = vi.fn();
    const onDeleteNote = vi.fn();
    const onCreateNote = vi.fn().mockResolvedValue(undefined);

    render(
      <NotesSection
        notes={[]}
        onAddNote={onAddNote}
        onEditNote={onEditNote}
        onDeleteNote={onDeleteNote}
        onCreateNote={onCreateNote}
      />
    );

    await user.click(screen.getByRole("button", { name: /add note/i }));

    const textarea = await screen.findByPlaceholderText(/start writing your note/i);
    await user.type(textarea, "New important insight");

    const saveButton = within(textarea.closest("form") as HTMLElement).getByRole("button", {
      name: /save note/i,
    });
    await user.click(saveButton);

    expect(onCreateNote).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "New important insight",
        category: categoryConfigMock.noteCategories[0],
      })
    );
  });

  it("supports updating existing notes with inline edits", async () => {
    const user = userEvent.setup();
    const originalNote = createMockNote({
      id: "note-1",
      content: "Existing note",
      updatedAt: new Date().toISOString(),
    });
    const onAddNote = vi.fn();
    const onEditNote = vi.fn();
    const onDeleteNote = vi.fn();
    const onUpdateNote = vi.fn().mockResolvedValue(undefined);

    render(
      <NotesSection
        notes={[originalNote]}
        onAddNote={onAddNote}
        onEditNote={onEditNote}
        onDeleteNote={onDeleteNote}
        onUpdateNote={onUpdateNote}
      />
    );

    const expandButton = screen.getByRole("button", { name: /expand note/i });
    await user.click(expandButton);

    const form = screen.getByLabelText(/note content/i).closest("form") as HTMLElement;
    const textarea = within(form).getByLabelText(/note content/i);
    await user.clear(textarea);
    await user.type(textarea, "Updated note content");

    const saveButton = within(form).getByRole("button", { name: /save note/i });
    await user.click(saveButton);

    expect(onUpdateNote).toHaveBeenCalledWith(
      originalNote.id,
      expect.objectContaining({ content: "Updated note content" })
    );
  });
});
