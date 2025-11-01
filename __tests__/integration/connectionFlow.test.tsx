import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  toast as mockToast,
  createMockCaseDisplay,
  createMockCaseRecord,
  createMockPerson,
} from "@/src/test/testUtils";
import App from "@/App";

vi.mock("@/components/modals/ConnectToExistingModal", () =>
  import("../__mocks__/ConnectToExistingModalStub"),
);

function buildInitialFileData() {
  const exportTimestamp = "2024-01-01T00:00:00.000Z";
  return {
    exported_at: exportTimestamp,
    total_cases: 1,
    cases: [
      createMockCaseDisplay({
        id: "case-initial",
        name: "Existing Case",
        mcn: "MCN-1234",
        createdAt: exportTimestamp,
        updatedAt: exportTimestamp,
        person: createMockPerson({
          id: "person-initial",
          firstName: "Existing",
          lastName: "Case",
          name: "Existing Case",
          email: "existing@example.com",
          phone: "555-000-0000",
          createdAt: exportTimestamp,
          dateAdded: exportTimestamp,
        }),
        caseRecord: createMockCaseRecord({
          id: "case-record-initial",
          mcn: "MCN-1234",
          applicationDate: "2024-01-02",
          description: "Initial description",
          personId: "person-initial",
          spouseId: "",
          status: "Pending",
          priority: false,
          withWaiver: false,
          admissionDate: "2024-01-03",
          retroRequested: "",
          financials: {
            resources: [],
            income: [],
            expenses: [],
          },
          notes: [],
          createdDate: exportTimestamp,
          updatedDate: exportTimestamp,
        }),
      }),
    ],
  };
}

const serviceState: {
  data: ReturnType<typeof buildInitialFileData>;
  lastWrite: ReturnType<typeof buildInitialFileData> | null;
  lastSaveTime: number | null;
} = {
  data: buildInitialFileData(),
  lastWrite: null,
  lastSaveTime: null,
};

vi.mock("@/utils/AutosaveFileService", () => {
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

  class MockAutosaveFileService {
    private statusCallback?: (status: any) => void;
    private dataLoadCallback?: (data: any) => void;
    private status: {
      status: string;
      message: string;
      timestamp: number;
      permissionStatus: string;
      lastSaveTime: number | null;
      consecutiveFailures: number;
      pendingWrites: number;
    } = {
      status: "waiting",
      message: "Awaiting connection",
      timestamp: Date.now(),
      permissionStatus: "granted",
      lastSaveTime: serviceState.lastSaveTime ?? null,
      consecutiveFailures: 0,
      pendingWrites: 0,
    };

    constructor(config: { statusCallback?: (status: any) => void } = {}) {
      this.statusCallback = config.statusCallback;
      this.emitStatus("waiting", "Awaiting connection", "granted");
      (globalThis as any).__connectionFlowDriver = {
        instance: this,
        emitStatus: (update: {
          status: string;
          message?: string;
          permissionStatus?: string;
          pendingWrites?: number;
          consecutiveFailures?: number;
        }) => {
          this.emitStatus(
            update.status,
            update.message ?? this.status.message,
            update.permissionStatus ?? this.status.permissionStatus,
            {
              pendingWrites:
                update.pendingWrites !== undefined ? update.pendingWrites : this.status.pendingWrites,
              consecutiveFailures:
                update.consecutiveFailures !== undefined
                  ? update.consecutiveFailures
                  : this.status.consecutiveFailures,
            },
          );
        },
      };
    }

    private emitStatus(
      status: string,
      message: string,
      permissionStatus: string,
      overrides: Partial<typeof this.status> = {},
    ) {
      const {
        pendingWrites = 0,
        consecutiveFailures = 0,
        lastSaveTime,
      } = overrides;
      this.status = {
        status,
        message,
        timestamp: Date.now(),
        permissionStatus,
        lastSaveTime: lastSaveTime ?? serviceState.lastSaveTime ?? null,
        pendingWrites,
        consecutiveFailures,
      };
      this.statusCallback?.({ ...this.status });
    }

    isSupported() {
      return true;
    }

    getStatus() {
      return {
        ...this.status,
        isRunning: this.status.status === "running",
        pendingWrites: this.status.pendingWrites,
      };
    }

    updateConfig() {
      // No-op for tests
    }

    startAutosave() {
      this.emitStatus("running", "Autosave started", this.status.permissionStatus);
    }

    stopAutosave() {
      this.emitStatus("connected", "Autosave stopped", this.status.permissionStatus);
    }

    async connect() {
      this.emitStatus("connected", "Connected to folder", "granted");
      return true;
    }

    async connectToExisting() {
      this.emitStatus("running", "Reconnected", "granted");
      setTimeout(() => {
        this.emitStatus("connected", "Connection ready", "granted");
      }, 0);
      return true;
    }

    async disconnect() {
      this.emitStatus("disconnected", "Disconnected", "prompt");
    }

    destroy() {
      if ((globalThis as any).__connectionFlowDriver?.instance === this) {
        delete (globalThis as any).__connectionFlowDriver;
      }
    }

    async save() {
      serviceState.lastSaveTime = Date.now();
      this.emitStatus("running", "Saved", this.status.permissionStatus);
    }

    async ensurePermission() {
      return true;
    }

    async listDataFiles() {
      return ["case-tracker-data.json"];
    }

    async readNamedFile() {
      return null;
    }

    async readFile() {
      return clone(serviceState.data);
    }

    async writeFile(data: any) {
      const cloned = clone(data);
      serviceState.data = cloned;
      serviceState.lastWrite = cloned;
      serviceState.lastSaveTime = Date.now();
      
      // Simulate save in progress
      this.emitStatus("running", "Saving...", "granted", { pendingWrites: 1 });
      
      // Simulate async save completion
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Save completed
      this.emitStatus("connected", "Saved", "granted", { pendingWrites: 0 });
      return true;
    }

    async loadExistingData() {
      const data = clone(serviceState.data);
      this.dataLoadCallback?.(data);
      return data;
    }

    async loadDataFromFile() {
      return this.loadExistingData();
    }

    initializeWithReactState() {
      // Not required for the integration test
    }

    setDataLoadCallback(callback: (data: any) => void) {
      this.dataLoadCallback = callback;
    }

    notifyDataChange() {
      if (this.dataLoadCallback) {
        this.dataLoadCallback(clone(serviceState.data));
      }
    }
  }

  return { default: MockAutosaveFileService };
});

describe("connect → load → edit → save flow", () => {
  const advanceTimers = async (ms = 0) => {
    await vi.advanceTimersByTimeAsync(ms);
  };

  const flushTimers = async () => {
    await act(async () => {
      await vi.runAllTimersAsync();
    });
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 20 });

    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("(prefers-color-scheme: dark)"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    class MockResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }

    class MockIntersectionObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }

    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    serviceState.data = buildInitialFileData();
    serviceState.lastWrite = null;
    serviceState.lastSaveTime = null;
    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.loading.mockClear();
    window.location.hash = "";
    delete (globalThis as any).__connectionFlowDriver;
  });

  afterEach(async () => {
    await flushTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (globalThis as any).__connectionFlowDriver;
  });

  it(
    "connects to storage, loads cases, edits a record, and persists changes",
    async () => {
    const user = userEvent.setup({ advanceTimers });
    render(<App />);
    await flushTimers();
      await screen.findByTestId("connect-modal");

    const connectButton = await screen.findByRole(
      "button",
      { name: /connect to previous folder/i },
      { timeout: 4000 },
    );
    await user.click(connectButton);
    await flushTimers();

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await screen.findByRole("heading", { name: /dashboard/i });
    await screen.findByText(/MCN: MCN-1234/i);

    await user.click(screen.getByRole("button", { name: /^view all$/i }));
    await screen.findByRole("heading", { name: /case management/i });

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await flushTimers();

    const firstNameInput = await screen.findByLabelText(/first name/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Updated");
    await flushTimers();

    const saveButton = screen.getByRole("button", { name: /update case/i });
    await user.click(saveButton);
    await flushTimers();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /update case/i })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        expect.stringMatching(/case for updated case updated successfully/i),
        expect.anything(),
      );
    });

    expect(serviceState.lastWrite).toBeTruthy();

    const lastWrite = serviceState.lastWrite;
    if (!lastWrite) {
      throw new Error("Expected serviceState.lastWrite to be defined");
    }

    expect(lastWrite.cases[0].person.firstName).toBe("Updated");
      expect(lastWrite.cases[0].name).toBe("Updated Case");
    },
    15000,
  );

  it(
    "re-opens the connection flow when permission is revoked mid-session",
    async () => {
    const user = userEvent.setup({ advanceTimers });
    render(<App />);
    await flushTimers();
      await screen.findByTestId("connect-modal");

    const connectButton = await screen.findByRole(
      "button",
      { name: /connect to previous folder/i },
      { timeout: 4000 },
    );
    await user.click(connectButton);
    await flushTimers();

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await screen.findByRole("heading", { name: /dashboard/i });

    const driver = (globalThis as any).__connectionFlowDriver;
    expect(driver).toBeDefined();

    act(() => {
      driver.emitStatus({
        status: "waiting",
        message: "Permission required to save changes",
        permissionStatus: "denied",
        pendingWrites: 1,
      });
    });

    const reconnectDialog = await screen.findByRole("dialog");
    expect(reconnectDialog).toBeInTheDocument();
      expect(
        await screen.findByText(/permission was previously denied/i),
      ).toBeInTheDocument();
    },
    15000,
  );
});
