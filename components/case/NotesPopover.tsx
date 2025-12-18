import { useState, useMemo, useCallback } from "react";
import { formatShortDate } from "../../utils/dateFormatting";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import { StickyNote, Plus, Trash2, X, Pencil, Check, Copy } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
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
  const [editCategory, setEditCategory] = useState("");
  const [newNoteCategory, setNewNoteCategory] = useState("");
  
  const { notes, addNote, updateNote, deleteNote } = useNotes(caseId);
  const { config } = useCategoryConfig();

  const noteCount = useMemo(() => notes?.length ?? 0, [notes]);
  
  const noteCategories = useMemo(() => {
    return config?.noteCategories ?? ["General", "Important", "Follow Up", "Contact"];
  }, [config]);

  const defaultCategory = useMemo(() => {
    return noteCategories[0] ?? "General";
  }, [noteCategories]);

  const getCategoryColor = useCallback((category: string) => {
    const colors: Record<string, string> = {
      General: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      Important: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      "Follow Up": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
      Contact: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    };
    return colors[category] ?? colors.General;
  }, []);

  const handleAddNote = useCallback(async () => {
    if (!newNoteContent.trim()) return;
    
    await addNote(caseId, {
      content: newNoteContent.trim(),
      category: newNoteCategory || defaultCategory,
    });
    
    setNewNoteContent("");
    setNewNoteCategory("");
    setIsAdding(false);
  }, [caseId, newNoteContent, newNoteCategory, addNote, defaultCategory]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    await deleteNote(caseId, noteId);
    setConfirmingDeleteId(null);
  }, [caseId, deleteNote]);

  const handleStartEdit = useCallback((note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditCategory(note.category);
    setConfirmingDeleteId(null);
  }, []);

  const handleSaveEdit = useCallback(async (note: Note) => {
    if (!editContent.trim()) return;
    
    await updateNote(caseId, note.id, {
      content: editContent.trim(),
      category: editCategory || note.category,
    });
    
    setEditingNoteId(null);
    setEditContent("");
    setEditCategory("");
  }, [caseId, editContent, editCategory, updateNote]);

  const handleCancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditContent("");
    setEditCategory("");
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
        className="w-80 p-0" 
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
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your note..."
              className="min-h-[80px] text-sm resize-none"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Select
                value={newNoteCategory || defaultCategory}
                onValueChange={setNewNoteCategory}
              >
                <SelectTrigger className="h-7 w-[120px] text-xs truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {noteCategories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-xs">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    setNewNoteCategory("");
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
                        <Select
                          value={editCategory || note.category}
                          onValueChange={setEditCategory}
                        >
                          <SelectTrigger className="h-6 w-[110px] text-xs truncate">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {noteCategories.map((cat) => (
                              <SelectItem key={cat} value={cat} className="text-xs">
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(note.createdAt)}
                        </span>
                      </div>
                      <Textarea
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
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleStartEdit(note)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getCategoryColor(note.category)}`}
                          >
                            {note.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(note.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {note.content}
                        </p>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            navigator.clipboard.writeText(note.content);
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

export default NotesPopover;
