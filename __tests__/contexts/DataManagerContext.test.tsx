import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DataManagerProvider,
  useDataManagerSafe,
} from "@/contexts/DataManagerContext";

const mockDataManagerClass = vi.hoisted(() => vi.fn());
let mockDataManagerInstance = {};

let mockFileStorageContext = {
  service: {
    getStatus: vi.fn(() => ({ isRunning: false })),
  },
  fileStorageService: null,
  isConnected: true,
  isWorkspaceReady: false,
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
    mockDataManagerClass.mockClear();
    mockDataManagerInstance = {};
    mockDataManagerClass.mockImplementation(() => mockDataManagerInstance);
    mockFileStorageContext = {
      service: {
        getStatus: vi.fn(() => ({ isRunning: false })),
      },
      fileStorageService: null,
      isConnected: true,
      isWorkspaceReady: false,
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

  it("creates a DataManager without performing startup migration work", async () => {
    // ARRANGE
    mockEncryptionContext = {
      isEncryptionEnabled: true,
      fileEncryptionStatus: "unencrypted",
      fileIsEncrypted: false,
      isStartupUnlockReady: false,
    };
    mockFileStorageContext = {
      ...mockFileStorageContext,
      isWorkspaceReady: true,
    };

    // ACT
    render(
      <DataManagerProvider>
        <TestChild />
      </DataManagerProvider>,
    );

    // ASSERT
    await waitFor(() => {
      expect(mockDataManagerClass).toHaveBeenCalledTimes(1);
    });
    expect("migrateFinancialsWithoutHistory" in mockDataManagerInstance).toBe(false);
  });

  it("still constructs a DataManager while encryption status is unknown", async () => {
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
    await waitFor(() => {
      expect(mockDataManagerClass).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps the safe DataManager unavailable until workspace startup is complete", async () => {
    // ARRANGE
    mockEncryptionContext = {
      ...mockEncryptionContext,
      isStartupUnlockReady: true,
    };

    function AvailabilityProbe() {
      const dataManager = useDataManagerSafe();

      return <div data-testid="availability">{dataManager ? "available" : "unavailable"}</div>;
    }

    const { rerender } = render(
      <DataManagerProvider>
        <AvailabilityProbe />
      </DataManagerProvider>,
    );

    // ASSERT
    expect(screen.getByTestId("availability").textContent).toBe("unavailable");

    // ACT
    mockFileStorageContext = {
      ...mockFileStorageContext,
      isWorkspaceReady: true,
    };
    rerender(
      <DataManagerProvider>
        <AvailabilityProbe />
      </DataManagerProvider>,
    );

    // ASSERT
    await waitFor(() => {
      expect(screen.getByTestId("availability").textContent).toBe("available");
    });
  });
});
