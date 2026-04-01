import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataManagerProvider } from "@/contexts/DataManagerContext";

const migrateFinancialsWithoutHistory = vi.fn<() => Promise<number>>();

const mockDataManagerClass = vi.hoisted(() => vi.fn());
let mockDataManagerInstance = {
  migrateFinancialsWithoutHistory,
};

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
  fileEncryptionStatus: "encrypted",
  fileIsEncrypted: true,
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
    mockDataManagerInstance = {
      migrateFinancialsWithoutHistory,
    };
    mockDataManagerClass.mockImplementation(() => mockDataManagerInstance);
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
      fileEncryptionStatus: "encrypted",
      fileIsEncrypted: true,
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

  it("does not block startup migration for unencrypted workspaces even when encryption mode is enabled", async () => {
    // ARRANGE
    migrateFinancialsWithoutHistory.mockResolvedValue(0);
    mockEncryptionContext = {
      isEncryptionEnabled: true,
      fileEncryptionStatus: "unencrypted",
      fileIsEncrypted: false,
      isStartupUnlockReady: false,
    };

    // ACT
    render(
      <DataManagerProvider>
        <TestChild />
      </DataManagerProvider>,
    );

    // ASSERT
    await waitFor(() => {
      expect(migrateFinancialsWithoutHistory).toHaveBeenCalledTimes(1);
    });
  });

  it("defers startup migration while file encryption status is still unknown", () => {
    // ARRANGE
    mockEncryptionContext = {
      isEncryptionEnabled: true,
      fileEncryptionStatus: "unknown",
      fileIsEncrypted: false,
      isStartupUnlockReady: false,
    };

    // ACT
    render(
      <DataManagerProvider>
        <TestChild />
      </DataManagerProvider>,
    );

    // ASSERT
    expect(migrateFinancialsWithoutHistory).not.toHaveBeenCalled();
  });
});
