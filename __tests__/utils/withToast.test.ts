import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { withToast, createToastWrapper } from '@/utils/withToast';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('withToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading toast and success on completion', async () => {
    const operation = vi.fn().mockResolvedValue({ id: '123' });

    const result = await withToast(operation, {
      loading: 'Loading...',
      success: 'Done!',
      error: 'Failed',
    });

    expect(toast.loading).toHaveBeenCalledWith('Loading...');
    expect(toast.success).toHaveBeenCalledWith('Done!', { id: 'toast-id', duration: undefined });
    expect(result).toEqual({ id: '123' });
  });

  it('shows loading toast and error on failure', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(
      withToast(operation, {
        loading: 'Loading...',
        success: 'Done!',
        error: 'Failed',
      })
    ).rejects.toThrow('Network error');

    expect(toast.loading).toHaveBeenCalledWith('Loading...');
    expect(toast.error).toHaveBeenCalledWith('Failed', { id: 'toast-id', duration: undefined });
  });

  it('supports dynamic success message', async () => {
    const operation = vi.fn().mockResolvedValue({ name: 'John' });

    await withToast<{ name: string }>(operation, {
      loading: 'Saving...',
      success: (result) => `Saved ${result.name}`,
      error: 'Failed',
    });

    expect(toast.success).toHaveBeenCalledWith('Saved John', { id: 'toast-id', duration: undefined });
  });

  it('supports dynamic error message', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Timeout'));

    await expect(
      withToast(operation, {
        loading: 'Loading...',
        success: 'Done!',
        error: (err) => `Error: ${err.message}`,
      })
    ).rejects.toThrow();

    expect(toast.error).toHaveBeenCalledWith('Error: Timeout', { id: 'toast-id', duration: undefined });
  });

  it('calls setError on failure', async () => {
    const setError = vi.fn();
    const operation = vi.fn().mockRejectedValue(new Error('Oops'));

    await expect(
      withToast(operation, {
        loading: 'Loading...',
        success: 'Done!',
        error: 'Something went wrong',
        setError,
      })
    ).rejects.toThrow();

    expect(setError).toHaveBeenCalledWith('Something went wrong');
  });

  it('clears error before operation and sets loading state', async () => {
    const setError = vi.fn();
    const setLoading = vi.fn();
    const operation = vi.fn().mockResolvedValue('ok');

    await withToast(operation, {
      loading: 'Loading...',
      success: 'Done!',
      error: 'Failed',
      setError,
      setLoading,
    });

    expect(setError).toHaveBeenCalledWith(null);
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it('returns null and dismisses toast if unmounted during operation', async () => {
    const isMounted = { current: true };
    const operation = vi.fn().mockImplementation(async () => {
      isMounted.current = false; // Simulate unmount during operation
      return { id: '123' };
    });

    const result = await withToast(operation, {
      loading: 'Loading...',
      success: 'Done!',
      error: 'Failed',
      isMounted,
    });

    expect(result).toBeNull();
    expect(toast.dismiss).toHaveBeenCalledWith('toast-id');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('dismisses toast and returns null if unmounted during error', async () => {
    const isMounted = { current: true };
    const operation = vi.fn().mockImplementation(async () => {
      isMounted.current = false;
      throw new Error('Fail');
    });

    const result = await withToast(operation, {
      loading: 'Loading...',
      success: 'Done!',
      error: 'Failed',
      isMounted,
    });

    expect(result).toBeNull();
    expect(toast.dismiss).toHaveBeenCalledWith('toast-id');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('respects custom durations', async () => {
    const operation = vi.fn().mockResolvedValue('ok');

    await withToast(operation, {
      loading: 'Loading...',
      success: 'Done!',
      error: 'Failed',
      successDuration: 5000,
    });

    expect(toast.success).toHaveBeenCalledWith('Done!', { id: 'toast-id', duration: 5000 });
  });
});

describe('createToastWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a wrapper with pre-configured options', async () => {
    const isMounted = { current: true };
    const setError = vi.fn();
    const setLoading = vi.fn();

    const toastOps = createToastWrapper({ isMounted, setError, setLoading });
    const operation = vi.fn().mockResolvedValue({ done: true });

    await toastOps(operation, {
      loading: 'Working...',
      success: 'Complete!',
      error: 'Oops',
    });

    expect(setLoading).toHaveBeenCalledWith(true);
    expect(setLoading).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalledWith('Complete!', { id: 'toast-id', duration: undefined });
  });
});
