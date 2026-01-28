import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the DataManager context
const mockAddNoteToCases = vi.fn().mockResolvedValue({ addedCount: 3 });

vi.mock('../../contexts/DataManagerContext', () => ({
  useDataManagerSafe: () => ({
    addNoteToCases: mockAddNoteToCases,
  }),
}));

// Import after mock is set up
import { useBulkNoteFlow } from '../../hooks/useBulkNoteFlow';

describe('useBulkNoteFlow', () => {
  const defaultCaseIds = ['case-1', 'case-2', 'case-3'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddNoteToCases.mockResolvedValue({ addedCount: 3 });
  });

  it('should initialize with modal closed', () => {
    const { result } = renderHook(() => useBulkNoteFlow({ selectedCaseIds: defaultCaseIds }));

    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('should open modal when openModal is called', () => {
    const { result } = renderHook(() => useBulkNoteFlow({ selectedCaseIds: defaultCaseIds }));

    act(() => {
      result.current.openModal();
    });

    expect(result.current.isModalOpen).toBe(true);
  });

  it('should not open modal when no cases selected', () => {
    const { result } = renderHook(() => useBulkNoteFlow({ selectedCaseIds: [] }));

    act(() => {
      result.current.openModal();
    });

    expect(result.current.isModalOpen).toBe(false);
  });

  it('should close modal when closeModal is called', () => {
    const { result } = renderHook(() => useBulkNoteFlow({ selectedCaseIds: defaultCaseIds }));

    act(() => {
      result.current.openModal();
    });
    expect(result.current.isModalOpen).toBe(true);

    act(() => {
      result.current.closeModal();
    });
    expect(result.current.isModalOpen).toBe(false);
  });

  it('should call dataManager.addNoteToCases and close modal on successful submit', async () => {
    const { result } = renderHook(() => useBulkNoteFlow({ selectedCaseIds: defaultCaseIds }));

    // Open modal first
    act(() => {
      result.current.openModal();
    });

    // Submit
    await act(async () => {
      await result.current.submitBulkNote({ content: 'Test note content', category: 'Important' });
    });

    expect(mockAddNoteToCases).toHaveBeenCalledWith(defaultCaseIds, {
      content: 'Test note content',
      category: 'Important',
    });
    expect(result.current.isModalOpen).toBe(false);
  });

  it('should set isSubmitting during submission', async () => {
    let resolveSubmit: (value: { addedCount: number }) => void;
    mockAddNoteToCases.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        })
    );

    const { result } = renderHook(() => useBulkNoteFlow({ selectedCaseIds: defaultCaseIds }));

    act(() => {
      result.current.openModal();
    });

    // Start submission (don't await)
    let submitPromise: Promise<void>;
    act(() => {
      submitPromise = result.current.submitBulkNote({ content: 'Test', category: 'General' });
    });

    // Should be submitting
    expect(result.current.isSubmitting).toBe(true);

    // Resolve and complete
    await act(async () => {
      resolveSubmit!({ addedCount: 3 });
      await submitPromise;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('should call onSuccess callback after successful submission', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useBulkNoteFlow({ selectedCaseIds: defaultCaseIds, onSuccess })
    );

    act(() => {
      result.current.openModal();
    });

    await act(async () => {
      await result.current.submitBulkNote({ content: 'Test', category: 'General' });
    });

    expect(onSuccess).toHaveBeenCalled();
  });
});
