import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { FileStorageProvider } from "@/contexts/FileStorageContext";
import { AutosaveStatusBadge } from "@/components/app/AutosaveStatusBadge";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

type StatusShape = {
  status: string;
  message: string;
  timestamp: number;
  permissionStatus: string;
  lastSaveTime: number | null;
  consecutiveFailures: number;
  pendingWrites: number;
};

vi.mock("@/utils/AutosaveFileService", () => {
  type AutosaveTestDriver = {
    token: symbol;
    emit: (update: Partial<StatusShape>) => void;
  };

  class MockAutosaveFileService {
    private status: StatusShape;
    private readonly statusCallback?: (status: StatusShape) => void;
    private isRunning = false;
    private readonly driverToken = Symbol("autosave-driver");

    constructor(config: { statusCallback?: (status: StatusShape) => void } = {}) {
      this.statusCallback = config.statusCallback;
      this.status = {
        status: "waiting",
        message: "Permission required to save changes",
        timestamp: Date.now(),
        permissionStatus: "prompt",
        lastSaveTime: null,
        consecutiveFailures: 0,
        pendingWrites: 0,
      };
      const driver: AutosaveTestDriver = {
        token: this.driverToken,
        emit: (update: Partial<StatusShape>) => {
          this.emit(update);
        },
      };
      (globalThis as any).__autosaveTestDriver = driver;
      this.emit({});
    }

    private emit(update: Partial<StatusShape>) {
      this.status = {
        ...this.status,
        ...update,
        status: update.status ?? this.status.status,
        message: update.message ?? this.status.message,
        permissionStatus: update.permissionStatus ?? this.status.permissionStatus,
        lastSaveTime: update.lastSaveTime ?? this.status.lastSaveTime,
        consecutiveFailures: update.consecutiveFailures ?? this.status.consecutiveFailures,
        pendingWrites: update.pendingWrites ?? this.status.pendingWrites,
        timestamp: Date.now(),
      };
      this.statusCallback?.({ ...this.status });
    }

    isSupported() {
      return true;
    }

    getStatus() {
      return {
        ...this.status,
        isRunning: this.isRunning,
        pendingWrites: this.status.pendingWrites,
        isSupported: true,
      };
    }

    updateConfig() {
      void 0;
    }

    startAutosave() {
      this.isRunning = true;
      this.emit({ status: "running", message: "Autosave active" });
    }

    stopAutosave() {
      this.isRunning = false;
      this.emit({ status: "stopped", message: "Autosave stopped" });
    }

    initializeWithReactState() {
      return this;
    }

    setDataLoadCallback() {
      void 0;
    }

    notifyDataChange() {
      void 0;
    }

    connect() {
      this.emit({ status: "connected", message: "Connected", permissionStatus: "granted" });
      return Promise.resolve(true);
    }

    connectToExisting() {
      this.emit({ status: "running", message: "Connected", permissionStatus: "granted" });
      return Promise.resolve(true);
    }

    disconnect() {
      this.emit({ status: "disconnected", message: "Disconnected", permissionStatus: "prompt" });
      return Promise.resolve();
    }

    save() {
      this.emit({ status: "saving", message: "Saving changes…", pendingWrites: 1, permissionStatus: "granted" });
      this.emit({
        status: "running",
        message: "All changes saved",
        pendingWrites: 0,
        lastSaveTime: Date.now(),
      });
      return Promise.resolve(true);
    }

    ensurePermission() {
      return Promise.resolve(true);
    }

    listDataFiles() {
      return Promise.resolve([]);
    }

    readNamedFile() {
      return Promise.resolve(null);
    }

    loadExistingData() {
      return Promise.resolve(null);
    }

    loadDataFromFile() {
      return Promise.resolve(null);
    }

    updateReactState() {
      void 0;
    }

    writeFile() {
      return Promise.resolve(true);
    }

    backupAndWrite() {
      return Promise.resolve({ backupCreated: false, written: true, backupName: "" });
    }

    destroy() {
      const driver = (globalThis as any).__autosaveTestDriver as AutosaveTestDriver | undefined;
      if (driver?.token === this.driverToken) {
        delete (globalThis as any).__autosaveTestDriver;
      }
    }
  }

  return { default: MockAutosaveFileService };
});

function AutosaveStatusHarness() {
  const summary = useAutosaveStatus();
  return <AutosaveStatusBadge summary={summary} showDetail data-testid="autosave-badge" />;
}

function emitStatus(update: Partial<StatusShape>) {
  const driver = (globalThis as any).__autosaveTestDriver as
    | { emit: (update: Partial<StatusShape>) => void }
    | undefined;
  if (!driver) {
    throw new Error("Autosave test driver is not available");
  }
  driver.emit(update);
}

describe("Autosave status indicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete (globalThis as any).__autosaveTestDriver;
  });

  it("surfaces saving progress and permission errors", async () => {
    render(
      <FileStorageProvider>
        <AutosaveStatusHarness />
      </FileStorageProvider>,
    );

    expect(await screen.findByText(/permission required/i)).toBeInTheDocument();

    act(() => {
      emitStatus({
        status: "saving",
        message: "Saving changes…",
        permissionStatus: "granted",
        pendingWrites: 2,
      });
    });

    const savingStatus = await screen.findByTestId("autosave-badge");
    expect(savingStatus).toHaveTextContent(/saving/i);
    expect(screen.getByText(/2 pending writes/i)).toBeInTheDocument();

    act(() => {
      emitStatus({
        status: "waiting",
        message: "Permission required to save changes",
        permissionStatus: "denied",
        pendingWrites: 2,
      });
    });

    const permissionStatus = await screen.findByTestId("autosave-badge");
    expect(permissionStatus).toHaveTextContent(/permission required/i);
    expect(screen.getByText(/2 pending writes/i)).toBeInTheDocument();

    act(() => {
      emitStatus({
        status: "retrying",
        message: "Autosave retrying (attempt 2)…",
        permissionStatus: "granted",
        pendingWrites: 1,
        consecutiveFailures: 1,
      });
    });

    const retryingStatus = await screen.findByTestId("autosave-badge");
    expect(retryingStatus).toHaveTextContent(/retrying save/i);
    const retrySpinner = retryingStatus.querySelector(".animate-spin");
    expect(retrySpinner).not.toBeNull();
    expect(screen.getByText(/attempt 2/i)).toBeInTheDocument();

    act(() => {
      emitStatus({
        status: "error",
        message: "Autosave failed — check permission",
        permissionStatus: "granted",
        pendingWrites: 3,
      });
    });

    const errorStatus = await screen.findByTestId("autosave-badge");
    expect(errorStatus).toHaveTextContent(/save failed/i);
    expect(screen.getByText(/Autosave failed/i)).toBeInTheDocument();
    expect(screen.getByText(/3 pending writes/i)).toBeInTheDocument();
    expect(errorStatus.querySelector(".animate-spin")).toBeNull();
  });
});
