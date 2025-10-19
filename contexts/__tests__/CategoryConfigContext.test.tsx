import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryConfigProvider, useCategoryConfig } from '../CategoryConfigContext';
import type { CategoryConfig } from '@/types/categoryConfig';

vi.mock('../DataManagerContext', () => ({
  useDataManagerSafe: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const { useDataManagerSafe } = await import('../DataManagerContext');
const { toast } = await import('sonner');

type MockedDataManager = {
  getCategoryConfig: ReturnType<typeof vi.fn>;
  updateCategoryValues: ReturnType<typeof vi.fn>;
  resetCategoryConfig: ReturnType<typeof vi.fn>;
};

describe('CategoryConfigContext', () => {
  let mockDataManager: MockedDataManager;

  beforeEach(() => {
    mockDataManager = {
      getCategoryConfig: vi.fn().mockResolvedValue({
        caseTypes: ['Type A'],
        caseStatuses: ['Pending'],
        livingArrangements: ['Apartment'],
        noteCategories: ['General'],
      } satisfies CategoryConfig),
      updateCategoryValues: vi.fn(),
      resetCategoryConfig: vi.fn(),
    };

    (useDataManagerSafe as ReturnType<typeof vi.fn>).mockReturnValue(mockDataManager);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CategoryConfigProvider>{children}</CategoryConfigProvider>
  );

  it('loads category configuration on mount', async () => {
    mockDataManager.getCategoryConfig.mockResolvedValueOnce({
      caseTypes: ['Custom Type'],
      caseStatuses: ['Status 1'],
      livingArrangements: ['Housing'],
      noteCategories: ['NoteCat'],
    } satisfies CategoryConfig);

    const { result } = renderHook(() => useCategoryConfig(), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.config.caseTypes).toEqual(['Custom Type']);
      expect(result.current.error).toBeNull();
    });
  });

  it('exposes an error when loading configuration fails', async () => {
    const failure = new Error('load failed');
    mockDataManager.getCategoryConfig.mockRejectedValueOnce(failure);

    const consoleSpy = vi.spyOn(console, 'error');

    const { result } = renderHook(() => useCategoryConfig(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Unable to load category options.');
    });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to load category configuration', failure);
  });

  it('updates a category with sanitized values and shows toasts', async () => {
    mockDataManager.updateCategoryValues.mockResolvedValueOnce({
      caseTypes: ['Type A'],
      caseStatuses: ['Pending', 'Approved'],
      livingArrangements: ['Apartment'],
      noteCategories: ['General'],
    } satisfies CategoryConfig);

    const { result } = renderHook(() => useCategoryConfig(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.updateCategory('caseStatuses', [' Pending ', 'pending', 'Approved ']);

    expect(toast.loading).toHaveBeenCalledWith('Saving options...');
    expect(mockDataManager.updateCategoryValues).toHaveBeenCalledWith('caseStatuses', ['Pending', 'Approved']);
    expect(toast.success).toHaveBeenCalledWith('Options updated', { id: 'toast-id' });
    expect(result.current.config.caseStatuses).toEqual(['Pending', 'Approved']);
    expect(result.current.error).toBeNull();
  });

  it('prevents updating categories when sanitized values are empty', async () => {
    const { result } = renderHook(() => useCategoryConfig(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.updateCategory('caseTypes', [' ', '']);

    expect(mockDataManager.updateCategoryValues).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Please provide at least one option.');
  });

  it('resets categories to defaults and reports via toast', async () => {
    mockDataManager.resetCategoryConfig.mockResolvedValueOnce({
      caseTypes: ['Default Type'],
      caseStatuses: ['Default Status'],
      livingArrangements: ['Default Housing'],
      noteCategories: ['Default Note'],
    } satisfies CategoryConfig);

    const { result } = renderHook(() => useCategoryConfig(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.resetToDefaults();

    expect(toast.loading).toHaveBeenCalledWith('Restoring defaults...');
    expect(mockDataManager.resetCategoryConfig).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Defaults restored', { id: 'toast-id' });
    expect(result.current.config.caseTypes).toEqual(['Default Type']);
  });

  it('supports manual refresh of configuration', async () => {
    const firstConfig: CategoryConfig = {
      caseTypes: ['Type 1'],
      caseStatuses: ['Status 1'],
      livingArrangements: ['Arrangement 1'],
      noteCategories: ['Note 1'],
    };
    const refreshedConfig: CategoryConfig = {
      caseTypes: ['Type 2'],
      caseStatuses: ['Status 2'],
      livingArrangements: ['Arrangement 2'],
      noteCategories: ['Note 2'],
    };

    mockDataManager.getCategoryConfig
      .mockResolvedValueOnce(firstConfig)
      .mockResolvedValueOnce(refreshedConfig);

    const { result } = renderHook(() => useCategoryConfig(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config.caseTypes).toEqual(['Type 1']);

    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.config.caseTypes).toEqual(['Type 2']);
      expect(mockDataManager.getCategoryConfig).toHaveBeenCalledTimes(2);
    });
  });

  it('falls back to default configuration when used outside provider', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useCategoryConfig());

    expect(result.current.config.caseStatuses.length).toBeGreaterThan(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      'useCategoryConfig was called outside of CategoryConfigProvider. Falling back to default configuration.',
    );
  });
});
