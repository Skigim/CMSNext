import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Note } from '../types/case';
import { Plus, MoreVertical, Edit2, Trash2, Calendar } from 'lucide-react';

interface NotesSectionProps {
  notes: Note[];
  onAddNote: () => void;
  onEditNote: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
}

export function NotesSection({ notes, onAddNote, onEditNote, onDeleteNote }: NotesSectionProps) {
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

  const sortedNotes = [...notes].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Card key="notes-section">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Notes
            {notes.length > 0 && (
              <Badge key="notes-count" variant="secondary" className="ml-2">
                {notes.length}
              </Badge>
            )}
          </CardTitle>
          <Button onClick={onAddNote} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Note
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sortedNotes.length === 0 ? (
          <div key="no-notes" className="text-center py-8">
            <p className="text-muted-foreground mb-4">No notes added yet</p>
            <Button onClick={onAddNote} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add First Note
            </Button>
          </div>
        ) : (
          <div key="notes-list" className="space-y-4">
            {sortedNotes.map((note, index) => {
              // Ensure a stable, unique key even if imported notes are missing ids
              const compositeKey = note.id || `${note.createdAt}-${note.content?.slice(0, 20) ?? ''}-${index}`;
              return (
              <Card key={compositeKey} className="border-l-4 border-l-primary/20">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge key={`badge-${compositeKey}`} className={getCategoryColor(note.category)}>
                        {note.category}
                      </Badge>
                      <div key={`date-${compositeKey}`} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {formatDate(note.createdAt)}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          key={`edit-${compositeKey}`}
                          onClick={() => onEditNote(note.id)}
                          className="cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          key={`delete-${compositeKey}`}
                          onClick={() => onDeleteNote(note.id)}
                          className="cursor-pointer text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap break-words">
                      {note.content}
                    </p>
                  </div>
                  
                  {note.updatedAt !== note.createdAt && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Last updated: {formatDate(note.updatedAt)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}