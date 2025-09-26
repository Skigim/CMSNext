import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { toast as mockToast } from "@/src/test/testUtils";

const initialFileData = vi.hoisted(() => ({
  exported_at: "2024-01-01T00:00:00.000Z",
  total_cases: 1,
  cases: [
    {
      id: "case-initial",
      name: "Existing Case",
      mcn: "MCN-1234",
      status: "In Progress",
      priority: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      person: {
        id: "person-initial",
        firstName: "Existing",
        lastName: "Case",
        name: "Existing Case",
        email: "existing@example.com",
        phone: "555-000-0000",
        dateOfBirth: "1990-01-01",
        ssn: "***-**-0000",
        organizationId: null,
        livingArrangement: "Apartment/House",
        address: {
          street: "123 Main St",
          city: "Omaha",
          state: "NE",
          zip: "68102",
        },
        mailingAddress: {
          street: "123 Main St",
          city: "Omaha",
          state: "NE",
          zip: "68102",
          sameAsPhysical: true,
        },
        authorizedRepIds: [],
        familyMembers: [],
        status: "Active",
        createdAt: "2024-01-01T00:00:00.000Z",
        dateAdded: "2024-01-01T00:00:00.000Z",
      },
      caseRecord: {
        id: "case-record-initial",
        mcn: "MCN-1234",
        applicationDate: "2024-01-02",
        caseType: "LTC",
        personId: "person-initial",
        spouseId: "",
        status: "In Progress",
        description: "Initial description",
        priority: false,
        livingArrangement: "Apartment/House",
        withWaiver: false,
        admissionDate: "2024-01-03",
        organizationId: "",
        authorizedReps: [],
        retroRequested: "",
        financials: {
          resources: [],
          income: [],
          expenses: [],
        },
        notes: [],
        createdDate: "2024-01-01T00:00:00.000Z",
        updatedDate: "2024-01-01T00:00:00.000Z",
      },
    },
  ],
}));

const serviceState = vi.hoisted(() => ({
  data: JSON.parse(JSON.stringify(initialFileData)),
  lastWrite: null as any,
  lastSaveTime: null as number | null,
}));

vi.mock("@/utils/AutosaveFileService", () => {
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

  class MockAutosaveFileService {
    private statusCallback?: (status: any) => void;
    private dataLoadCallback?: (data: any) => void;
    private status = {
      status: "waiting",
      message: "Awaiting connection",
      timestamp: Date.now(),
      permissionStatus: "granted",
      lastSaveTime: null,
      consecutiveFailures: 0,
    };

    constructor(config: { statusCallback?: (status: any) => void } = {}) {
      this.statusCallback = config.statusCallback;
      this.emitStatus("waiting", "Awaiting connection", "granted");
    }

    private emitStatus(status: string, message: string, permissionStatus: string) {
      this.status = {
        status,
        message,
        timestamp: Date.now(),
        permissionStatus,
        lastSaveTime: serviceState.lastSaveTime,
        consecutiveFailures: 0,
      };
      this.statusCallback?.({ ...this.status });
    }

    isSupported() {
      return true;
    }

    getStatus() {
      return { ...this.status, isRunning: this.status.status === "running" };
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
      return true;
    }

    async disconnect() {
      this.emitStatus("disconnected", "Disconnected", "prompt");
    }

    destroy() {
      // No-op cleanup hook for tests
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
      serviceState.data = clone(data);
      serviceState.lastWrite = serviceState.data;
      this.emitStatus("running", "Saved", "granted");
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
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("(prefers-color-scheme: dark)"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

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

    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      value: MockResizeObserver,
    });
    Object.defineProperty(window, "IntersectionObserver", {
      writable: true,
      value: MockIntersectionObserver,
    });

    // Keep Node global references in sync for Radix internals
    // @ts-expect-error - assigning to global for test environment
    global.ResizeObserver = MockResizeObserver;
    // @ts-expect-error - assigning to global for test environment
    global.IntersectionObserver = MockIntersectionObserver;

    serviceState.data = JSON.parse(JSON.stringify(initialFileData));
    serviceState.lastWrite = null;
    serviceState.lastSaveTime = null;
    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.loading.mockClear();
    window.location.hash = "";
  });

  it("connects to storage, loads cases, edits a record, and persists changes", async () => {
    const user = userEvent.setup();
    render(<App />);

    const connectButton = await screen.findByRole("button", { name: /connect to previous folder/i });
    await user.click(connectButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await screen.findByRole("heading", { name: /dashboard/i });
    await screen.findByText(/MCN: MCN-1234/i);

    await user.click(screen.getByRole("button", { name: /^view all$/i }));
    await screen.findByRole("heading", { name: /case management/i });

    await user.click(screen.getByRole("button", { name: /edit/i }));

    const firstNameInput = await screen.findByLabelText(/first name/i);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Updated");

    const saveButton = screen.getByRole("button", { name: /update case/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /update case/i })).not.toBeInTheDocument();
    });

    await screen.findByText(/case for updated case updated successfully/i);

    expect(serviceState.lastWrite).toBeTruthy();
    expect(serviceState.lastWrite.cases[0].person.firstName).toBe("Updated");
    expect(serviceState.lastWrite.cases[0].name).toBe("Updated Case");
  });
});
