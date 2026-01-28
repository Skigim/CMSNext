import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkNoteModal } from '../../components/case/BulkNoteModal';
import { CategoryConfigContext } from '../../contexts/CategoryConfigContext';
import type { CategoryConfig } from '../../types/categoryConfig';

const mockCategoryConfig: CategoryConfig = {
  caseTypes: ['Standard', 'Emergency'],
  applicationTypes: ['New Application'],
  caseStatuses: [{ name: 'Active', colorSlot: 'blue' }],
  livingArrangements: ['Home', 'Facility'],
  noteCategories: ['General', 'Important', 'Follow-up'],
  alertTypes: [{ name: 'Court Notice', colorSlot: 'red' }, { name: 'Income Verification', colorSlot: 'amber' }],
  verificationStatuses: ['Needs VR', 'Verified'],
  summaryTemplate: {
    sectionOrder: ['notes', 'caseInfo', 'personInfo', 'relationships', 'resources', 'income', 'expenses', 'avsTracking'],
    defaultSections: {
      notes: true,
      caseInfo: true,
      personInfo: true,
      relationships: true,
      resources: true,
      income: true,
      expenses: true,
      avsTracking: true,
    },
    sectionTemplates: {},
  },
};

const mockContextValue = {
  config: mockCategoryConfig,
  loading: false,
  error: null,
  refresh: vi.fn().mockResolvedValue(undefined),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  resetToDefaults: vi.fn().mockResolvedValue(undefined),
  setConfigFromFile: vi.fn(),
};

const renderWithContext = (ui: React.ReactElement) => {
  return render(
    <CategoryConfigContext.Provider value={mockContextValue}>
      {ui}
    </CategoryConfigContext.Provider>
  );
};

describe('BulkNoteModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    isSubmitting: false,
    selectedCount: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when open', () => {
    renderWithContext(<BulkNoteModal {...defaultProps} />);
    
    // Use getByRole for dialog, then check textarea exists
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter note content/i)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    renderWithContext(<BulkNoteModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText(/Add Note to/)).not.toBeInTheDocument();
  });

  it('should show singular case text for single case', () => {
    renderWithContext(<BulkNoteModal {...defaultProps} selectedCount={1} />);
    
    // Check for the modal title with "Case" (singular)
    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toBeInTheDocument();
    expect(title.textContent).toMatch(/Add Note to.*1.*Case/);
  });

  it('should display category dropdown with default value', () => {
    renderWithContext(<BulkNoteModal {...defaultProps} />);
    
    // Check the combobox is rendered
    const categoryTrigger = screen.getByRole('combobox');
    expect(categoryTrigger).toBeInTheDocument();
    // General should be the default value shown
    expect(categoryTrigger).toHaveTextContent('General');
  });

  it('should call onSubmit with content and category when submitted', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    
    renderWithContext(<BulkNoteModal {...defaultProps} onSubmit={onSubmit} />);
    
    // Enter note content
    const textarea = screen.getByPlaceholderText(/enter note content/i);
    await user.type(textarea, 'This is a bulk note');
    
    // Submit (default category is General)
    const submitButton = screen.getByRole('button', { name: /add note/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        content: 'This is a bulk note',
        category: 'General'
      });
    });
  });

  it('should disable submit button when content is empty', () => {
    renderWithContext(<BulkNoteModal {...defaultProps} />);
    
    const submitButton = screen.getByRole('button', { name: /add note/i });
    expect(submitButton).toBeDisabled();
  });

  it('should disable submit button when submitting', async () => {
    const user = userEvent.setup();
    renderWithContext(<BulkNoteModal {...defaultProps} isSubmitting={true} />);
    
    const textarea = screen.getByPlaceholderText(/enter note content/i);
    await user.type(textarea, 'Some content');
    
    const submitButton = screen.getByRole('button', { name: /adding/i });
    expect(submitButton).toBeDisabled();
  });

  it('should call onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    
    renderWithContext(<BulkNoteModal {...defaultProps} onClose={onClose} />);
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should clear form when closed and reopened', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithContext(<BulkNoteModal {...defaultProps} />);
    
    // Type some content
    const textarea = screen.getByPlaceholderText(/enter note content/i);
    await user.type(textarea, 'Test content');
    expect(textarea).toHaveValue('Test content');
    
    // Close modal
    rerender(
      <CategoryConfigContext.Provider value={mockContextValue}>
        <BulkNoteModal {...defaultProps} isOpen={false} />
      </CategoryConfigContext.Provider>
    );
    
    // Reopen modal
    rerender(
      <CategoryConfigContext.Provider value={mockContextValue}>
        <BulkNoteModal {...defaultProps} isOpen={true} />
      </CategoryConfigContext.Provider>
    );
    
    // Form should be cleared
    const newTextarea = screen.getByPlaceholderText(/enter note content/i);
    expect(newTextarea).toHaveValue('');
  });

  it('should render with empty categories config', () => {
    const emptyConfig: CategoryConfig = {
      ...mockCategoryConfig,
      noteCategories: [],
    };
    
    const emptyContextValue = {
      ...mockContextValue,
      config: emptyConfig,
    };
    
    render(
      <CategoryConfigContext.Provider value={emptyContextValue}>
        <BulkNoteModal {...defaultProps} />
      </CategoryConfigContext.Provider>
    );
    
    // Should still render the modal
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter note content/i)).toBeInTheDocument();
  });
});
