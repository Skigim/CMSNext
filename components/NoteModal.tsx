import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Note, NewNoteData } from '../types/case';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteData: NewNoteData) => Promise<void>;
  editingNote?: Note;
}

const noteCategories = [
  'General',
  'VR Update',
  'Client Contact',
  'Case Review',
  'Document Request',
  'Follow-up Required',
  'Important',
  'Medical Update',
  'Financial Update',
  'Other'
];

export const NoteModal = React.forwardRef<HTMLDivElement, NoteModalProps>(
  ({ isOpen, onClose, onSave, editingNote }, ref) => {
    const [category, setCategory] = useState('');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
      if (editingNote) {
        setCategory(editingNote.category || 'General');
        setContent(editingNote.content || '');
      } else {
        setCategory('General');
        setContent('');
      }
    }, [editingNote, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!category?.trim() || !content?.trim()) {
        return;
      }

      setIsSubmitting(true);
      try {
        await onSave({
          category: category?.trim() || 'General',
          content: content?.trim() || ''
        });
        onClose();
      } catch (error) {
        console.error('Failed to save note:', error);
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleClose = () => {
      if (!isSubmitting) {
        setCategory('General');
        setContent('');
        onClose();
      }
    };

    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent ref={ref} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? 'Edit Note' : 'Add New Note'}
            </DialogTitle>
            <DialogDescription>
              {editingNote 
                ? 'Update the note category and content below.'
                : 'Add a new note to this case.'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {noteCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Note Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter note content..."
                className="min-h-[120px] resize-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !category?.trim() || !content?.trim()}
              >
                {isSubmitting ? 'Saving...' : editingNote ? 'Update Note' : 'Add Note'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);

NoteModal.displayName = 'NoteModal';