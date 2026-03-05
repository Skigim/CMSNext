import { vi } from "vitest";
import type { LocalStorageAdapter } from "@/utils/localStorage";

const adapterMockRead = vi.fn<() => unknown>(() => null);
const adapterMockWrite = vi.fn<(value: unknown) => void>();
const adapterMockClear = vi.fn<() => void>();

const adapter: LocalStorageAdapter<unknown> = {
  key: "cmsnext-test-key",
  read: adapterMockRead,
  write: adapterMockWrite,
  clear: adapterMockClear,
};

const createLocalStorageAdapterMock = vi.fn(() => adapter);
const hasLocalStorageMock = vi.fn(() => true);

export const localStorageAdapterModuleMock = {
  createLocalStorageAdapter: createLocalStorageAdapterMock,
  hasLocalStorage: hasLocalStorageMock,
};

export const localStorageAdapterMock = {
  adapter,
  mockRead: adapterMockRead,
  mockWrite: adapterMockWrite,
  mockClear: adapterMockClear,
  createLocalStorageAdapterMock,
  hasLocalStorageMock,
  reset(nextReadValue: unknown): void {
    adapterMockRead.mockReset();
    adapterMockWrite.mockReset();
    adapterMockClear.mockReset();
    adapterMockRead.mockReturnValue(nextReadValue);
    createLocalStorageAdapterMock.mockReset();
    createLocalStorageAdapterMock.mockReturnValue(adapter);
    hasLocalStorageMock.mockReset();
    hasLocalStorageMock.mockReturnValue(true);
  },
};

export interface TypedLocalStorageAdapterMock<T> {
  adapter: LocalStorageAdapter<T>;
  mockRead: ReturnType<typeof vi.fn<() => T>>;
  mockWrite: ReturnType<typeof vi.fn<(value: T) => void>>;
  mockClear: ReturnType<typeof vi.fn<() => void>>;
  reset(nextReadValue: T): void;
  getLastWrite(): T | undefined;
}

export const asTypedLocalStorageAdapterMock = <T>(): TypedLocalStorageAdapterMock<T> => ({
  adapter: localStorageAdapterMock.adapter as LocalStorageAdapter<T>,
  mockRead: localStorageAdapterMock.mockRead as ReturnType<typeof vi.fn<() => T>>,
  mockWrite: localStorageAdapterMock.mockWrite as ReturnType<typeof vi.fn<(value: T) => void>>,
  mockClear: localStorageAdapterMock.mockClear,
  reset: (nextReadValue: T) => localStorageAdapterMock.reset(nextReadValue),
  getLastWrite: () => {
    const { calls } = localStorageAdapterMock.mockWrite.mock;
    const lastCall = calls[calls.length - 1];
    return lastCall?.[0] as T | undefined;
  },
});
