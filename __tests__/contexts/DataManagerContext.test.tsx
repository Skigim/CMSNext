import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataManagerProvider } from "@/contexts/DataManagerContext";

const migrateFinancialsWithoutHistory = vi.fn<() => Promise<number>>();

const mockDataManagerClass = vi.hoisted(() => {
  return vi.fn().mockImplementation(() => ({
    migrateFinancialsWithoutHistory,
  }));
});

let mockFileStorageContext = {
  service: {
    getStatus: vi.fn(() => ({ isRunning: false })),
  },
  fileStorageService: null,
  isConnected: true,
  status: {
    status: "connected",
    permissionStatus: "granted",
  },
};

let mockEncryptionContext = {
  isEncryptionEnabled: true,
  isStartupUnlockReady: false,
};

vi.mock("@/utils/DataManager", () => ({
  DataManager: mockDataManagerClass,
}));

vi.mock("@/contexts/FileStorageContext", () => ({
  useFileStorage: () => mockFileStorageContext,
}));

vi.mock("@/contexts/EncryptionContext", () => ({
  useEncryption: () => mockEncryptionContext,
}));

function TestChild({ children }: Readonly<{ children?: ReactNode }>) {
  return <>{children ?? <div data-testid="child">ready</div>}</>;
}

describe("DataManagerContext", () => {
  beforeEach(() => {
    migrateFinancialsWithoutHistory.mockReset();
    mockDataManagerClass.mockClear();
    mockFileStorageContext = {
      service: {
        getStatus: vi.fn(() => ({ isRunning: false })),
      },
      fileStorageService: null,
      isConnected: true,
      status: {
        status: "connected",
        permissionStatus: "granted",
      },
    };
    mockEncryptionContext = {
      isEncryptionEnabled: true,
      isStartupUnlockReady: false,
    };
  });

  it("retries startup financial migration after a transient first failure once unlock readiness is satisfied", async () => {
    // ARRANGE
    migrateFinancialsWithoutHistory
      .mockRejectedValueOnce(new Error("temporary read failure"))
      .mockResolvedValueOnce(0);

    const { rerender } = render(
      <DataManagerProvider>
        <TestChild />
      </DataManagerProvider>,
    );

    // ASSERT
    expect(migrateFinancialsWithoutHistory).not.toHaveBeenCalled();

    // ACT
    mockEncryptionContext = {
      ...mockEncryptionContext,
      isStartupUnlockReady: true,
    };
    rerender(
      <DataManagerProvider>
        <TestChild />
      </DataManagerProvider>,
    );

    // ASSERT
    await waitFor(() => {
      expect(migrateFinancialsWithoutHistory).toHaveBeenCalledTimes(2);
    });

    // ACT
    rerender(
      <DataManagerProvider>
        <TestChild />
      </DataManagerProvider>,
    );

    // ASSERT
    await waitFor(() => {
      expect(migrateFinancialsWithoutHistory).toHaveBeenCalledTimes(2);
    });
  });
});
