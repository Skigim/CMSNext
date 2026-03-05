import { vi } from "vitest";
import type { LocalStorageAdapter } from "@/utils/localStorage";

const mockRead = vi.fn<() => unknown>(() => null);
const mockWrite = vi.fn<(value: unknown) => void>();
const mockClear = vi.fn<() => void>();

const adapter: LocalStorageAdapter<unknown> = {
  key: "cmsnext-test-key",
  read: mockRead,
  write: mockWrite,
  clear: mockClear,
};

const createLocalStorageAdapterMock = vi.fn(() => adapter);
const hasLocalStorageMock = vi.fn(() => true);

export const localStorageAdapterModuleMock = {
  createLocalStorageAdapter: createLocalStorageAdapterMock,
  hasLocalStorage: hasLocalStorageMock,
};

export const localStorageAdapterMock = {
  adapter,
  mockRead,
  mockWrite,
  mockClear,
  createLocalStorageAdapterMock,
  hasLocalStorageMock,
  reset(nextReadValue: unknown): void {
    mockRead.mockReset();
    mockWrite.mockReset();
    mockClear.mockReset();
    mockRead.mockReturnValue(nextReadValue);
    createLocalStorageAdapterMock.mockReset();
    createLocalStorageAdapterMock.mockReturnValue(adapter);
    hasLocalStorageMock.mockReset();
    hasLocalStorageMock.mockReturnValue(true);
  },
};
