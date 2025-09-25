import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotesSection } from '@/components/case/NotesSection';
import type { Note } from '@/types/case';

// Mock UI components to focus on key generation logic
vi.mock('../ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div data-testid="card-content" {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div data-testid="card-header" {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <div data-testid="card-title" {...props}>{children}</div>
}));

vi.mock('../ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  )
}));

vi.mock('../ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>
}));

vi.mock('../ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>
}));

const mockProps = {
  onAddNote: vi.fn(),
  onEditNote: vi.fn(),
  onDeleteNote: vi.fn(),
};

// Helper to create valid Note objects
const createNote = (content: string, id: string = '', category: string = 'General'): Note => ({
  id,
  content,
  category,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z'
});

describe('NotesSection Key Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without errors with Unicode content', () => {
    const notesWithUnicode: Note[] = [
      createNote('测试内容 - Chinese content', '', 'General'),
      createNote('نص عربي - Arabic content', '', 'VR Update'),
      createNote('🎉💻🚀 Emoji test', '', 'Client Contact'),
      createNote('Special chars: ñáéíóú çüß', '', 'Follow-up Required')
    ];
    
    // Should not throw encoding errors during render
    expect(() => {
      render(<NotesSection notes={notesWithUnicode} {...mockProps} />);
    }).not.toThrow();

    // Should render all notes
    expect(screen.getByText(/测试内容/)).toBeInTheDocument();
    expect(screen.getByText(/نص عربي/)).toBeInTheDocument();
    expect(screen.getByText(/🎉💻🚀/)).toBeInTheDocument();
    expect(screen.getByText(/ñáéíóú çüß/)).toBeInTheDocument();
  });

  it('should handle empty notes list', () => {
    render(<NotesSection notes={[]} {...mockProps} />);
    expect(screen.getByText('No notes added yet')).toBeInTheDocument();
  });

  it('should render notes with proper categories', () => {
    const categorizedNotes: Note[] = [
      createNote('General note', 'note-1', 'General'),
      createNote('VR update note', 'note-2', 'VR Update'),
      createNote('Client contact note', 'note-3', 'Client Contact')
    ];
    
    render(<NotesSection notes={categorizedNotes} {...mockProps} />);
    
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('VR Update')).toBeInTheDocument();
    expect(screen.getByText('Client Contact')).toBeInTheDocument();
  });

  it('should handle notes without IDs gracefully', () => {
    const notesWithoutIds: Note[] = [
      createNote('First note without ID'),
      createNote('Second note without ID'),
      createNote('Third note without ID')
    ];
    
    // Should render without React key warnings
    expect(() => {
      render(<NotesSection notes={notesWithoutIds} {...mockProps} />);
    }).not.toThrow();
    
    expect(screen.getByText('First note without ID')).toBeInTheDocument();
    expect(screen.getByText('Second note without ID')).toBeInTheDocument();
    expect(screen.getByText('Third note without ID')).toBeInTheDocument();
  });

  it('should handle edge case content for key generation', () => {
    const edgeCaseNotes: Note[] = [
      createNote(''), // Empty content
      createNote('   '), // Whitespace only
      createNote('Very long content '.repeat(20)), // Very long content
      createNote('Content with \u0000 null chars') // Special characters
    ];
    
    expect(() => {
      render(<NotesSection notes={edgeCaseNotes} {...mockProps} />);
    }).not.toThrow();
  });
});