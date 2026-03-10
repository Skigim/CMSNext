import { vi } from "vitest";
import type { LocalStorageAdapter } from "@/utils/localStorage";

interface AdapterMockState {
  adapter: LocalStorageAdapter<unknown>;
  mockRead: ReturnType<typeof vi.fn<() => unknown>>;
  mockWrite: ReturnType<typeof vi.fn<(value: unknown) => void>>;
  mockClear: ReturnType<typeof vi.fn<() => void>>;
}

const adapterStates = new Map<string, AdapterMockState>();
let lastRequestedKey = "cmsnext-test-key";

function createAdapterState(key: string): AdapterMockState {
  const mockRead = vi.fn<() => unknown>(() => null);
  const mockWrite = vi.fn<(value: unknown) => void>();
  const mockClear = vi.fn<() => void>();

  return {
    adapter: {
      key,
      read: mockRead,
      write: mockWrite,
      clear: mockClear,
    },
    mockRead,
    mockWrite,
    mockClear,
  };
}

function getAdapterState(key: string): AdapterMockState {
  const existingState = adapterStates.get(key);
  if (existingState) {
    return existingState;
  }

  const nextState = createAdapterState(key);
  adapterStates.set(key, nextState);
  return nextState;
}

function getDefaultAdapterState(): AdapterMockState {
  return getAdapterState(lastRequestedKey);
}

const createLocalStorageAdapterMock = vi.fn((key: string) => {
  lastRequestedKey = key;
  return getAdapterState(key).adapter;
});

const hasLocalStorageMock = vi.fn(() => true);

export const localStorageAdapterModuleMock = {
  createLocalStorageAdapter: createLocalStorageAdapterMock,
  hasLocalStorage: hasLocalStorageMock,
};

export const localStorageAdapterMock = {
  get adapter() {
    return getDefaultAdapterState().adapter;
  },
  get mockRead() {
    return getDefaultAdapterState().mockRead;
  },
  get mockWrite() {
    return getDefaultAdapterState().mockWrite;
  },
  get mockClear() {
    return getDefaultAdapterState().mockClear;
  },
  createLocalStorageAdapterMock,
  hasLocalStorageMock,
  reset(nextReadValue: unknown, key?: string): void {
    const targetState = key ? getAdapterState(key) : getDefaultAdapterState();
    targetState.mockRead.mockReset();
    targetState.mockWrite.mockReset();
    targetState.mockClear.mockReset();
    targetState.mockRead.mockReturnValue(nextReadValue);
    createLocalStorageAdapterMock.mockClear();
    hasLocalStorageMock.mockReset();
    hasLocalStorageMock.mockReturnValue(true);
  },
  resetAll(): void {
    for (const state of adapterStates.values()) {
      state.mockRead.mockReset();
      state.mockWrite.mockReset();
      state.mockClear.mockReset();
    }
    createLocalStorageAdapterMock.mockClear();
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

export const asTypedLocalStorageAdapterMock = <T>(
  key?: string
): TypedLocalStorageAdapterMock<T> => {
  const getState = () => (key ? getAdapterState(key) : getDefaultAdapterState());

  return {
    get adapter() {
      return getState().adapter as LocalStorageAdapter<T>;
    },
    get mockRead() {
      return getState().mockRead as ReturnType<typeof vi.fn<() => T>>;
    },
    get mockWrite() {
      return getState().mockWrite as ReturnType<typeof vi.fn<(value: T) => void>>;
    },
    get mockClear() {
      return getState().mockClear;
    },
    reset: (nextReadValue: T) => {
      const targetKey = key ?? lastRequestedKey;
      localStorageAdapterMock.reset(nextReadValue, targetKey);
    },
    getLastWrite: () => {
      const { calls } = getState().mockWrite.mock;
      const lastCall = calls[calls.length - 1];
      return lastCall?.[0] as T | undefined;
    },
  };
};
