import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CaseDetails } from '@/components/case/CaseDetails';
import type { CaseDisplay } from '@/types/case';

const clickToCopyMock = vi.fn(() => Promise.resolve(true));

vi.mock('@/utils/clipboard', () => ({
  clickToCopy: clickToCopyMock,
}));

// Mock dependencies to focus on memory management
vi.mock('../ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  )
}));

const caseSectionPropsByCategory = new Map<string, any>();

vi.mock('../case/CaseSection', () => ({
  CaseSection: (props: any) => {
    caseSectionPropsByCategory.set(props.category, props);
    return (
      <div data-testid={`case-section-${props.category}`}>
        <span>{props.title}</span>
      </div>
    );
  },
}));

const notesSectionRenderProps: any[] = [];

vi.mock('../case/NotesSection', () => ({
  NotesSection: (props: any) => {
    notesSectionRenderProps.push(props);
    return <div data-testid="notes-section" />;
  },
}));

vi.mock('../case/CaseStatusMenu', () => ({
  CaseStatusMenu: (props: any) => (
    <button
      data-testid="case-status-badge"
      onClick={() => props.onUpdateStatus?.(props.caseId, 'Approved')}
    >
      {props.status ?? 'Pending'}
    </button>
  ),
}));

vi.mock('../case/CaseAlertsDrawer', () => ({
  CaseAlertsDrawer: ({ alerts, caseId, caseStatus, onUpdateCaseStatus }: any) => (
    <div
      data-testid="case-alerts-drawer"
      data-alert-count={alerts?.length ?? 0}
      data-case-id={caseId ?? ''}
      data-case-status={caseStatus ?? ''}
      data-has-status-handler={Boolean(onUpdateCaseStatus)}
    />
  ),
}));

vi.mock('../ui/alert-dialog', () => {
  const passthrough = ({ children }: any) => <>{children}</>;
  const ActionButton = ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  );

  return {
    AlertDialog: passthrough,
    AlertDialogTrigger: passthrough,
    AlertDialogContent: passthrough,
    AlertDialogDescription: passthrough,
    AlertDialogFooter: passthrough,
    AlertDialogHeader: passthrough,
    AlertDialogTitle: passthrough,
    AlertDialogAction: ActionButton,
    AlertDialogCancel: ActionButton,
  };
});

vi.mock('../ui/toggle-group', () => ({
  ToggleGroup: ({ children, onValueChange: _onValueChange, value: _value, ...props }: any) => (
    <div data-testid="toggle-group" {...props}>
      {children}
    </div>
  ),
  ToggleGroupItem: ({ children, value, onClick, ...props }: any) => (
    <button 
      onClick={() => onClick?.(value)} 
      data-value={value} 
      {...props}
    >
      {children}
    </button>
  )
}));

const mockCase: CaseDisplay = {
  id: 'test-case-1',
  name: 'John Doe',
  mcn: '12345',
  status: 'Pending',
  priority: false,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  person: {
    id: 'person-1',
    firstName: 'John',
    lastName: 'Doe',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '(555) 123-4567',
    dateOfBirth: '',
    ssn: '',
    organizationId: null,
    livingArrangement: '',
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '12345'
    },
    mailingAddress: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '12345',
      sameAsPhysical: true
    },
    authorizedRepIds: [],
    familyMembers: [],
    status: 'Active',
    createdAt: '2025-01-01T00:00:00Z',
    dateAdded: '2025-01-01T00:00:00Z'
  },
  caseRecord: {
    id: 'case-1',
    mcn: '12345',
    applicationDate: '2025-01-01',
    caseType: 'Standard',
    personId: 'person-1',
    spouseId: '',
  status: 'Pending',
    description: '',
    priority: false,
    livingArrangement: '',
    withWaiver: false,
    admissionDate: '',
    organizationId: '',
    authorizedReps: [],
    retroRequested: '',
    financials: {
      resources: [],
      income: [],
      expenses: []
    },
    notes: [],
    createdDate: '2025-01-01T00:00:00Z',
    updatedDate: '2025-01-01T00:00:00Z'
  }
};

const mockProps = {
  case: mockCase,
  onEdit: vi.fn(),
  onBack: vi.fn(),
  onDelete: vi.fn(),
  onAddItem: vi.fn(),
  onEditItem: vi.fn(),
  onDeleteItem: vi.fn(),
  onAddNote: vi.fn(),
  onEditNote: vi.fn(),
  onDeleteNote: vi.fn(),
  onUpdateStatus: vi.fn(),
};

describe('CaseDetails Memory Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    caseSectionPropsByCategory.clear();
    notesSectionRenderProps.length = 0;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    clickToCopyMock.mockClear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should not update state after component unmounts during view transitions', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const { unmount } = render(<CaseDetails {...mockProps} />);
    
    // Find and click any button that might trigger state changes
    const buttons = screen.queryAllByRole('button');
    
    if (buttons.length > 0) {
      // Trigger an action that might use setTimeout
      fireEvent.click(buttons[0]);
    }
    
    // Unmount component immediately after triggering action
    unmount();
    
  // Fast-forward through any pending timeouts without risking infinite loops
  vi.runOnlyPendingTimers();
    
    // Should not have any React state update warnings
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('memory leak')
    );
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('state update')
    );
    
    consoleSpy.mockRestore();
  });

  it('should cleanup setTimeout references on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    
    const { unmount } = render(<CaseDetails {...mockProps} />);
    
    // Trigger any actions that might create timeouts
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      try {
        fireEvent.click(button);
      } catch (e) {
        // Some buttons might not be functional in test env
      }
    });
    
    const timeoutCallsBefore = setTimeoutSpy.mock.calls.length;
    
    // Unmount component
    unmount();
    
    // If any timeouts were created, they should be cleared
    if (timeoutCallsBefore > 0) {
      expect(clearTimeoutSpy).toHaveBeenCalled();
    }
    
    clearTimeoutSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it('should handle rapid mount/unmount cycles without memory leaks', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Simulate rapid mounting and unmounting
    for (let i = 0; i < 10; i++) {
      const { unmount } = render(<CaseDetails {...mockProps} />);
      
      // Immediately unmount
      unmount();
      
      // Run any pending timers
      vi.runAllTimers();
    }
    
    // Should not accumulate memory leak warnings
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('memory leak')
    );
    
    consoleSpy.mockRestore();
  });

  it('should properly track mount state with useRef pattern', () => {
    const { unmount, rerender } = render(<CaseDetails {...mockProps} />);
    
    // Component should render without errors
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    
    // Re-render with updated props
    const updatedCase = {
      ...mockCase,
      person: { ...mockCase.person, firstName: 'Jane' },
      name: 'Jane Doe'
    };
    
    rerender(<CaseDetails {...mockProps} case={updatedCase} />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    
    // Unmount should not cause issues
    expect(() => unmount()).not.toThrow();
  });

  it('should handle async operations during unmount gracefully', async () => {
    const { unmount } = render(<CaseDetails {...mockProps} />);
    
    // Trigger any async operations
    const editButton = screen.queryByText(/edit/i);
    if (editButton) {
      fireEvent.click(editButton);
    }
    
    // Unmount before async operations complete
    unmount();
    
    // Wait for any promises to resolve
    await waitFor(() => {}, { timeout: 100 });
    
    // Should not throw unhandled promise rejections
    expect(true).toBe(true); // Test passes if no errors thrown
  });

  it('renders header information and updates when props change', () => {
    vi.useRealTimers();

    const caseWithStatus = {
      ...mockCase,
      status: 'Pending',
      mcn: '12345',
    };

    const { rerender } = render(<CaseDetails {...mockProps} case={caseWithStatus} />);

    expect(screen.getByRole('heading', { name: 'John Doe' })).toBeInTheDocument();
    expect(screen.getByText('12345')).toBeInTheDocument();
    expect(screen.getByTestId('case-status-badge')).toHaveTextContent('Pending');

    const updatedCase = {
      ...caseWithStatus,
      name: 'Jane Doe',
      mcn: '67890',
      status: 'Active',
    };

    rerender(<CaseDetails {...mockProps} case={updatedCase} />);

    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();
    expect(screen.getByText('67890')).toBeInTheDocument();
    expect(screen.getByTestId('case-status-badge')).toHaveTextContent('Active');
  });

  it('copies the MCN to the clipboard when the copy control is clicked', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();

    render(<CaseDetails {...mockProps} />);

    const copyButton = screen.getByRole('button', { name: /copy mcn 12345/i });
    await user.click(copyButton);

    expect(clickToCopyMock).toHaveBeenCalledWith('12345');
    expect(copyButton).toHaveAttribute('aria-label', 'Copy MCN 12345');
  });

  it('calls navigation handlers when action buttons are clicked', async () => {
    vi.useRealTimers();
    const onBack = vi.fn();
    const onEdit = vi.fn();
    const user = userEvent.setup();

    render(<CaseDetails {...mockProps} onBack={onBack} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('confirms deletion through alert dialog flow', async () => {
    vi.useRealTimers();
    const onDelete = vi.fn();
    const user = userEvent.setup();

    render(<CaseDetails {...mockProps} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /delete case/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('wires financial tabs to the correct CaseSection props', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();

    const financialCase: CaseDisplay = {
      ...mockCase,
      caseRecord: {
        ...mockCase.caseRecord,
        financials: {
          resources: [
            {
              id: 'res-1',
              description: 'Resource 1',
              amount: 100,
              verificationStatus: 'Verified',
              notes: '',
            },
          ],
          income: [
            {
              id: 'inc-1',
              description: 'Income 1',
              amount: 200,
              verificationStatus: 'VR Pending',
              notes: '',
            },
          ],
          expenses: [
            {
              id: 'exp-1',
              description: 'Expense 1',
              amount: 50,
              verificationStatus: 'Needs VR',
              notes: '',
            },
          ],
        },
      },
    };

    render(<CaseDetails {...mockProps} case={financialCase} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    expect(caseSectionPropsByCategory.get('resources').items).toEqual(financialCase.caseRecord.financials.resources);
    expect(screen.getByRole('tab', { name: /resources/i })).toHaveAttribute('data-state', 'active');

    await user.click(screen.getByRole('tab', { name: /income/i }));
    expect(caseSectionPropsByCategory.get('income').items).toEqual(financialCase.caseRecord.financials.income);
    expect(screen.getByRole('tab', { name: /income/i })).toHaveAttribute('data-state', 'active');

    await user.click(screen.getByRole('tab', { name: /expenses/i }));
    expect(caseSectionPropsByCategory.get('expenses').items).toEqual(financialCase.caseRecord.financials.expenses);
    expect(screen.getByRole('tab', { name: /expenses/i })).toHaveAttribute('data-state', 'active');
  });

  it('invokes onBatchUpdateItem when CaseSection requests an update', async () => {
    vi.useRealTimers();
    const onBatchUpdateItem = vi.fn().mockResolvedValue(undefined);

    render(<CaseDetails {...mockProps} onBatchUpdateItem={onBatchUpdateItem} />);

    const sectionProps = caseSectionPropsByCategory.get('resources');
    const updatedItem = {
      id: 'mock-item',
      description: 'Updated',
      amount: 123,
      verificationStatus: 'Verified',
    };

    await sectionProps.onUpdateFullItem('resources', 'mock-item', updatedItem);

    expect(onBatchUpdateItem).toHaveBeenCalledWith('resources', 'mock-item', updatedItem);
  });

  it('logs and swallows errors when batch update fails', async () => {
    vi.useRealTimers();
    const error = new Error('boom');
    const onBatchUpdateItem = vi.fn().mockRejectedValue(error);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<CaseDetails {...mockProps} onBatchUpdateItem={onBatchUpdateItem} />);

    const sectionProps = caseSectionPropsByCategory.get('resources');

    await sectionProps.onUpdateFullItem('resources', 'mock-item', {
      id: 'mock-item',
      description: 'Broken',
      amount: 10,
      verificationStatus: 'Needs VR',
    });

    expect(onBatchUpdateItem).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('[CaseDetails] Failed to update item:', error);

    consoleSpy.mockRestore();
  });

  it('safely handles missing batch update handler', async () => {
    vi.useRealTimers();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<CaseDetails {...mockProps} />);

    const sectionProps = caseSectionPropsByCategory.get('resources');

    await sectionProps.onUpdateFullItem('resources', 'mock-item', {
      id: 'mock-item',
      description: 'No handler',
      amount: 0,
      verificationStatus: 'VR Pending',
    });

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('passes note handlers through to NotesSection', () => {
    vi.useRealTimers();

    const noteHandlers = {
      onAddNote: vi.fn(),
      onEditNote: vi.fn(),
      onDeleteNote: vi.fn(),
      onBatchUpdateNote: vi.fn(),
      onBatchCreateNote: vi.fn(),
    };

    const caseWithNotes: CaseDisplay = {
      ...mockCase,
      caseRecord: {
        ...mockCase.caseRecord,
        notes: [
          {
            id: 'note-1',
            category: 'General',
            content: 'Test note',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
      },
    };

    render(
      <CaseDetails
        {...mockProps}
        {...noteHandlers}
        case={caseWithNotes}
      />
    );

  const latestProps = notesSectionRenderProps[notesSectionRenderProps.length - 1];

    expect(latestProps?.notes).toEqual(caseWithNotes.caseRecord.notes);
    expect(latestProps?.onAddNote).toBe(noteHandlers.onAddNote);
    expect(latestProps?.onEditNote).toBe(noteHandlers.onEditNote);
    expect(latestProps?.onDeleteNote).toBe(noteHandlers.onDeleteNote);
    expect(latestProps?.onUpdateNote).toBe(noteHandlers.onBatchUpdateNote);
    expect(latestProps?.onCreateNote).toBe(noteHandlers.onBatchCreateNote);
  });

  it("should have proper heading hierarchy", () => {
    vi.useRealTimers();
    render(<CaseDetails {...mockProps} />);
    
    // Verify main heading exists
    const mainHeading = screen.getByRole('heading', { name: 'John Doe' });
    expect(mainHeading).toBeInTheDocument();
  });

  it("should have accessible button labels", () => {
    vi.useRealTimers();
    render(<CaseDetails {...mockProps} />);
    
    // Verify all buttons have accessible text/aria-labels
    const backButton = screen.getByRole('button', { name: /back/i });
    const editButton = screen.getByRole('button', { name: /edit/i });
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    
    expect(backButton).toBeInTheDocument();
    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });

  it("should support keyboard navigation in action buttons", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onBack = vi.fn();
    
    render(<CaseDetails {...mockProps} onBack={onBack} />);
    
    // Focus and interact with back button using keyboard
    const backButton = screen.getByRole('button', { name: /back/i });
    backButton.focus();
    expect(backButton).toHaveFocus();
    
    await user.keyboard('{Enter}');
    expect(onBack).toHaveBeenCalled();
  });

  it("should have accessible copy button with aria-label", () => {
    vi.useRealTimers();
    render(<CaseDetails {...mockProps} />);
    
    const copyButton = screen.getByRole('button', { name: /copy mcn/i });
    expect(copyButton).toHaveAttribute('aria-label');
    expect(copyButton.getAttribute('aria-label')).toMatch(/copy mcn/i);
  });
});