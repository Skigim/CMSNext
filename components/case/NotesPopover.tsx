import { useState, useMemo, useCallback, useRef } from "react";
import { formatShortDate } from "@/domain/common";
import { Button } from "../ui/button";
import { MultiSelect } from "../ui/multi-select";
import { Textarea } from "../ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Badge } from "../ui/badge";
import { StickyNote, Plus, Trash2, X, Pencil, Check, Copy } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { getStaticNoteCategoryColor } from "@/utils/styleUtils";
import { clickToCopy } from "@/utils/clipboard";
import type { Note } from "@/types/case";

interface NotesPopoverProps {
  caseId: string;
  className?: string;
}

export function NotesPopover({ caseId, className }: NotesPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [newNoteCategories, setNewNoteCategories] = useState<string[]>([]);
  const quickAddTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  const { notes, addNote, updateNote, deleteNote } = useNotes(caseId);
  const { config } = useCategoryConfig();

  const noteCount = useMemo(() => notes?.length ?? 0, [notes]);
  
  const noteCategories = useMemo(() => {
    return config?.noteCategories ?? ["General", "Important", "Follow Up", "Contact"];
  }, [config]);

  const defaultCategory = useMemo(() => {
    return noteCategories[0] ?? "General";
  }, [noteCategories]);

  const noteCategoryOptions = useMemo(() => {
    const categorySet = new Set<string>(noteCategories);

    if (notes) {
      for (const note of notes) {
        if (note.category) {
          categorySet.add(note.category);
        }

        if (note.categories) {
          for (const category of note.categories) {
            if (category) {
              categorySet.add(category);
            }
          }
        }
      }
    }

    return Array.from(categorySet).map((category) => ({
      label: category,
      value: category,
    }));
  }, [noteCategories, notes]);

  const getCategoryColor = useCallback(
    (category: string) => getStaticNoteCategoryColor(category),
    []
  );

  const getNoteCategories = useCallback((note: Pick<Note, "category" | "categories">) => {
    const categories = note.categories?.filter(Boolean) ?? [];
    return categories.length > 0 ? categories : [note.category || defaultCategory];
  }, [defaultCategory]);

  const handleAddNote = useCallback(async () => {
    if (!newNoteContent.trim()) return;
    const categories = newNoteCategories.length > 0 ? newNoteCategories : [defaultCategory];
    
    await addNote(caseId, {
      content: newNoteContent.trim(),
      category: categories[0],
      categories,
    });
    
    setNewNoteContent("");
    setNewNoteCategories([]);
    setIsAdding(false);
  }, [caseId, newNoteContent, newNoteCategories, addNote, defaultCategory]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    await deleteNote(caseId, noteId);
    setConfirmingDeleteId(null);
  }, [caseId, deleteNote]);

  const handleStartEdit = useCallback((note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditCategories(getNoteCategories(note));
    setConfirmingDeleteId(null);
  }, [getNoteCategories]);

  const handleSaveEdit = useCallback(async (note: Note) => {
    if (!editContent.trim()) return;
    const categories = editCategories.length > 0 ? editCategories : getNoteCategories(note);
    
    await updateNote(caseId, note.id, {
      content: editContent.trim(),
      category: categories[0],
      categories,
    });
    
    setEditingNoteId(null);
    setEditContent("");
    setEditCategories([]);
  }, [caseId, editContent, editCategories, getNoteCategories, updateNote]);

  const handleCancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditContent("");
    setEditCategories([]);
  }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent, note: Note) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveEdit(note);
    }
    if (e.key === "Escape") {
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAddNote();
    }
    if (e.key === "Escape") {
      setIsAdding(false);
      setNewNoteContent("");
    }
  }, [handleAddNote]);

  const restoreQuickAddFocus = useCallback(() => {
    quickAddTextareaRef.current?.focus();
  }, []);

  const restoreEditFocus = useCallback(() => {
    editTextareaRef.current?.focus();
  }, []);

  const formatDate = formatShortDate;

  const sortedNotes = useMemo(() => {
    if (!notes) return [];
    return [...notes].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notes]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
        >
          <StickyNote className="h-4 w-4 mr-2" />
          <span>Notes{noteCount > 0 ? ` (${noteCount})` : ""}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent 
        data-papercut-context="NotesPopover"
        className="w-96 p-0" 
        align="start"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <StickyNote className="h-4 w-4" />
            Notes {noteCount > 0 && <Badge variant="secondary" className="text-xs">{noteCount}</Badge>}
          </div>
          {!isAdding && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>

        {/* Quick Add Form */}
        {isAdding && (
          <div className="border-b p-3 space-y-2">
            <Textarea
              ref={quickAddTextareaRef}
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your note..."
              className="min-h-[80px] text-sm resize-none"
              autoFocus
            />
            <div data-testid="notes-quick-add-actions" className="flex flex-wrap items-center gap-2">
              <MultiSelect
                options={noteCategoryOptions}
                value={newNoteCategories}
                onValueChange={setNewNoteCategories}
                placeholder={defaultCategory}
                searchPlaceholder="Search categories..."
                emptyText="No categories found."
                ariaLabel="Select note categories"
                className="w-auto min-w-[10rem] max-w-full"
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  restoreQuickAddFocus();
                }}
              />
              <span className="text-xs text-muted-foreground flex-1">
                {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    setIsAdding(false);
                    setNewNoteContent("");
                    setNewNoteCategories([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7"
                  onClick={handleAddNote}
                  disabled={!newNoteContent.trim()}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Notes List */}
        <div>
          {sortedNotes.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notes yet</p>
              <p className="text-xs mt-1">Click Add to create one</p>
            </div>
          ) : (
            <div className="divide-y">
              {sortedNotes.map((note: Note) => (
                <div 
                  key={note.id} 
                  className="p-3 hover:bg-muted/50 group relative"
                >
                  {editingNoteId === note.id ? (
                    /* Edit Mode */
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <MultiSelect
                          options={noteCategoryOptions}
                          value={editCategories}
                          onValueChange={setEditCategories}
                          placeholder={getNoteCategories(note)[0]}
                          searchPlaceholder="Search categories..."
                          emptyText="No categories found."
                          ariaLabel="Edit note categories"
                          className="h-6 w-auto min-w-[8rem] max-w-full px-2"
                          onCloseAutoFocus={(event) => {
                            event.preventDefault();
                            restoreEditFocus();
                          }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {formatDate(note.createdAt)}
                        </span>
                      </div>
                      <Textarea
                        ref={editTextareaRef}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, note)}
                        className="min-h-[60px] text-sm resize-none"
                        autoFocus
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to save
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => handleSaveEdit(note)}
                            disabled={!editContent.trim()}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="flex-1 min-w-0 cursor-pointer text-left bg-transparent border-0 p-0"
                        onClick={() => handleStartEdit(note)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            {getNoteCategories(note).map(category => (
                              <Badge
                                key={category}
                                variant="secondary"
                                className={`text-xs ${getCategoryColor(category)}`}
                              >
                                {category}
                              </Badge>
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(note.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {note.content}
                        </p>
                      </button>
                      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            void clickToCopy(note.content, {
                              successMessage: "Note copied to clipboard",
                            });
                          }}
                          aria-label="Copy note"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {confirmingDeleteId === note.id ? (
                          <>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleDeleteNote(note.id)}
                              aria-label="Confirm delete note"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setConfirmingDeleteId(null)}
                              aria-label="Cancel delete"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => handleStartEdit(note)}
                              aria-label="Edit note"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setConfirmingDeleteId(note.id)}
                              aria-label="Delete note"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
