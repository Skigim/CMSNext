import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Note, NewNoteData } from '../types/case';
import { Plus, ChevronDown, Check, X, Trash2, StickyNote, Calendar } from 'lucide-react';

interface NoteCardProps {
  note: Note & { isNew?: boolean };
  onSave: (note: Note) => void;
  onDelete: (noteId: string) => void;
  startExpanded?: boolean;
}

function NoteCard({ note, onSave, onDelete, startExpanded = false }: NoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(startExpanded);
  const [editedNote, setEditedNote] = useState(note);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height based on content
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isExpanded, editedNote.content]);

  // If the note prop changes, update the local editedNote state
  useEffect(() => {
    setEditedNote(note);
  }, [note]);

  const handleToggle = () => {
    if (!isExpanded) {
      setIsExpanded(true);
    } else if (!note.isNew) {
      // Don't allow collapsing a new note, it must be saved or canceled
      // Reset form data if collapsing without saving
      setEditedNote(note);
      setIsExpanded(false);
    }
  };

  const handleCancel = () => {
    if (note.isNew) {
      onDelete(note.id); // If it's a new note, canceling deletes it
    } else {
      setEditedNote(note); // Otherwise, just reset and collapse
      setIsExpanded(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedNote.category.trim() || !editedNote.content.trim()) return;
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isNew, ...noteToSave } = editedNote;
    onSave(noteToSave as Note);
    setIsExpanded(false);
  };

  const handleChange = (field: string, value: string) => {
    setEditedNote(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmingDelete) {
      setConfirmingDelete(false);
    } else {
      setConfirmingDelete(true);
    }
  };

  const handleDeleteConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(note.id);
    setConfirmingDelete(false);
  };

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      'General': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      'VR Update': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      'Client Contact': 'bg-green-500/10 text-green-600 border-green-500/20',
      'Case Review': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      'Document Request': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      'Follow-up Required': 'bg-red-500/10 text-red-600 border-red-500/20',
      'Important': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      'Medical Update': 'bg-pink-500/10 text-pink-600 border-pink-500/20',
      'Financial Update': 'bg-teal-500/10 text-teal-600 border-teal-500/20',
      'Other': 'bg-slate-500/10 text-slate-600 border-slate-500/20'
    };
    return colorMap[category] || colorMap['Other'];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateText = (text: string, maxLength = 100) => {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className={`bg-card border rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 ease-in-out w-full relative ${note.isNew ? 'border-dashed border-primary/50 bg-primary/5' : ''}`}>
      {/* Display Header (Always Visible) - Clickable */}
      <div 
        className="p-4 cursor-pointer" 
        onClick={() => !isExpanded && handleToggle()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 text-primary p-2 rounded-lg">
              <StickyNote className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={getCategoryColor(note.category || 'General')}>
                  {note.category || 'General'}
                </Badge>
                {note.createdAt && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {formatDate(note.createdAt)}
                  </div>
                )}
              </div>
              {!isExpanded && (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {truncateText(note.content)}
                </p>
              )}
            </div>
          </div>
          {!note.isNew && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleToggle(); }}
              className="text-muted-foreground hover:text-primary p-1 transition-colors"
              aria-label="Expand note"
            >
              <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Delete Button - Only visible when expanded, overlapping the top-right corner */}
      {isExpanded && !note.isNew && (
        <div className="absolute -top-2 -right-2 z-10">
          {!confirmingDelete ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              className="h-8 w-8 p-0 bg-background/90 backdrop-blur-sm border border-border/50 text-destructive hover:text-destructive hover:bg-destructive/10 shadow-sm hover:animate-pulse hover:scale-110 transition-all duration-200"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteConfirm}
                className="h-8 w-8 p-0 bg-background/90 backdrop-blur-sm border border-border/50 text-green-600 hover:text-green-700 hover:bg-green-50 shadow-sm"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteClick}
                className="h-8 w-8 p-0 bg-background/90 backdrop-blur-sm border border-border/50 text-red-600 hover:text-red-700 hover:bg-red-50 shadow-sm"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Accordion Content (Editable Form) */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1000px]' : 'max-h-0'}`}>
        <form onSubmit={handleSave} className="p-4 border-t space-y-4 bg-muted/20">
          <div>
            <Label htmlFor={`category-${note.id}`} className="block text-sm font-medium text-foreground mb-1">
              Category
            </Label>
            <Select value={editedNote.category} onValueChange={(value) => handleChange('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="VR Update">VR Update</SelectItem>
                <SelectItem value="Client Contact">Client Contact</SelectItem>
                <SelectItem value="Case Review">Case Review</SelectItem>
                <SelectItem value="Document Request">Document Request</SelectItem>
                <SelectItem value="Follow-up Required">Follow-up Required</SelectItem>
                <SelectItem value="Important">Important</SelectItem>
                <SelectItem value="Medical Update">Medical Update</SelectItem>
                <SelectItem value="Financial Update">Financial Update</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor={`content-${note.id}`} className="block text-sm font-medium text-foreground mb-1">
              Note Content
            </Label>
            <Textarea
              ref={textareaRef}
              id={`content-${note.id}`}
              value={editedNote.content}
              onChange={(e) => handleChange('content', e.target.value)}
              className="w-full resize-none overflow-hidden min-h-[100px]"
              placeholder="Start writing your note..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="outline" onClick={handleCancel} className="flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex items-center gap-2"
              disabled={!editedNote.category.trim() || !editedNote.content.trim()}
            >
              <Check className="w-4 h-4" /> Save Note
            </Button>
          </div>
        </form>
      </div>
      
      {/* Show last updated for existing notes */}
      {!isExpanded && note.updatedAt && note.updatedAt !== note.createdAt && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground">
            Last updated: {formatDate(note.updatedAt)}
          </p>
        </div>
      )}
    </div>
  );
}

interface NotesSectionProps {
  notes: Note[];
  onAddNote: () => void;
  onEditNote: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onUpdateNote?: (noteId: string, updatedNote: NewNoteData) => Promise<void>;
  onCreateNote?: (noteData: NewNoteData) => Promise<void>;
}

export function NotesSection({ 
  notes, 
  onAddNote,  
  onDeleteNote,
  onUpdateNote,
  onCreateNote
}: NotesSectionProps) {
  const [skeletonNotes, setSkeletonNotes] = useState<string[]>([]);

  // Create a skeleton note for new notes
  const createSkeletonNote = (id: string): Note & { isNew: boolean } => ({
    id,
    category: 'General',
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isNew: true,
  });

  // Handle adding a new skeleton note
  const handleAddSkeleton = () => {
    const skeletonId = `skeleton-note-${Date.now()}`;
    setSkeletonNotes(prev => [skeletonId, ...prev]);
  };

  // Handle saving a skeleton note
  const handleSaveSkeleton = async (skeletonId: string, noteData: Note) => {
    if (onCreateNote) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, createdAt, updatedAt, ...createData } = noteData;
        await onCreateNote(createData as NewNoteData);
        setSkeletonNotes(prev => prev.filter(id => id !== skeletonId));
      } catch (error) {
        console.error('Failed to create note:', error);
      }
    }
  };

  // Handle updating an existing note
  const handleUpdateNote = async (noteId: string, noteData: Note) => {
    if (onUpdateNote) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, createdAt, updatedAt, ...updateData } = noteData;
        await onUpdateNote(noteId, updateData as NewNoteData);
      } catch (error) {
        console.error('Failed to update note:', error);
      }
    }
  };

  // Handle cancelling a skeleton note
  const handleCancelSkeleton = (skeletonId: string) => {
    setSkeletonNotes(prev => prev.filter(id => id !== skeletonId));
  };

  // Sort notes by creation date (newest first)
  const sortedNotes = [...notes].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Combine real notes with skeleton notes
  const allNotes = [
    ...skeletonNotes.map(id => createSkeletonNote(id)),
    ...sortedNotes
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Notes
            {notes.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {notes.length}
              </Badge>
            )}
          </CardTitle>
          <Button 
            onClick={onCreateNote ? handleAddSkeleton : onAddNote} 
            size="sm"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Note
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {allNotes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No notes added yet</p>
            <Button 
              onClick={onCreateNote ? handleAddSkeleton : onAddNote} 
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add First Note
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {allNotes.map((note) => {
              // Generate stable keys for notes, handling Unicode content safely
              let contentHash = '';
              if (note.content) {
                try {
                  // Handle non-Latin-1 characters safely
                  contentHash = btoa(unescape(encodeURIComponent(note.content.slice(0, 50)))).slice(0, 8);
                } catch (error) {
                  // Fallback for encoding errors
                  contentHash = note.content.slice(0, 8).replace(/[^a-zA-Z0-9]/g, '');
                }
              }
              const compositeKey = note.id || `${note.createdAt}-${contentHash}`;
              const isSkeleton = typeof note.id === 'string' && note.id.startsWith('skeleton-note-');
              
              return (
                <NoteCard
                  key={compositeKey}
                  note={note}
                  onSave={isSkeleton ? 
                    (noteData) => handleSaveSkeleton(note.id, noteData) :
                    (noteData) => handleUpdateNote(note.id, noteData)
                  }
                  onDelete={isSkeleton ? 
                    () => handleCancelSkeleton(note.id) : 
                    onDeleteNote
                  }
                  startExpanded={isSkeleton}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}