import { describe, expect, it } from "vitest";
import {
  initialMachineState,
  reduceFileStorageState,
  type FileStorageStatus,
} from "../fileStorageMachine";

describe("fileStorageMachine", () => {
  const baseStatus = (overrides: Partial<FileStorageStatus> = {}): FileStorageStatus => ({
    status: "initialized",
    message: "",
    timestamp: Date.now(),
    permissionStatus: "prompt",
    lastSaveTime: null,
    consecutiveFailures: 0,
    ...overrides,
  });

  it("marks service unsupported when initialization reports lack of support", () => {
    const state = reduceFileStorageState(initialMachineState, {
      type: "SERVICE_INITIALIZED",
      supported: false,
    });

    expect(state.lifecycle).toBe("unsupported");
    expect(state.isSupported).toBe(false);
    expect(state.isConnected).toBe(false);
  });

  it("enters ready state when permission is granted after explicit connection", () => {
    const supportedState = reduceFileStorageState(initialMachineState, {
      type: "SERVICE_INITIALIZED",
      supported: true,
    });

    const requestingState = reduceFileStorageState(supportedState, { type: "CONNECT_REQUESTED" });
    const confirmedState = reduceFileStorageState(requestingState, { type: "CONNECT_CONFIRMED" });

    const readyState = reduceFileStorageState(confirmedState, {
      type: "STATUS_CHANGED",
      status: baseStatus({ status: "running", permissionStatus: "granted" }),
    });

    expect(readyState.lifecycle).toBe("ready");
    expect(readyState.permissionStatus).toBe("granted");
    expect(readyState.isConnected).toBe(true);
    expect(readyState.hasStoredHandle).toBe(true);
  });

  it("transitions to blocked when permission is denied", () => {
    const supportedState = reduceFileStorageState(initialMachineState, {
      type: "SERVICE_INITIALIZED",
      supported: true,
    });

    const confirmedState = reduceFileStorageState(supportedState, { type: "CONNECT_CONFIRMED" });

    const blockedState = reduceFileStorageState(confirmedState, {
      type: "STATUS_CHANGED",
      status: baseStatus({ status: "waiting", permissionStatus: "denied" }),
    });

    expect(blockedState.lifecycle).toBe("blocked");
    expect(blockedState.permissionStatus).toBe("denied");
    expect(blockedState.isConnected).toBe(false);
    expect(blockedState.hasStoredHandle).toBe(false);
  });

  it("resets connection flags when disconnected", () => {
    const supportedState = reduceFileStorageState(initialMachineState, {
      type: "SERVICE_INITIALIZED",
      supported: true,
    });

    const confirmedState = reduceFileStorageState(supportedState, { type: "CONNECT_CONFIRMED" });

    const readyState = reduceFileStorageState(confirmedState, {
      type: "STATUS_CHANGED",
      status: baseStatus({ status: "connected", permissionStatus: "granted" }),
    });

    const disconnectedState = reduceFileStorageState(readyState, { type: "DISCONNECTED" });

    expect(disconnectedState.lifecycle).toBe("idle");
    expect(disconnectedState.isConnected).toBe(false);
    expect(disconnectedState.hasStoredHandle).toBe(false);
    expect(disconnectedState.explicitlyConnected).toBe(false);
  });

  it("clears stored error when a healthy status arrives", () => {
    const supportedState = reduceFileStorageState(initialMachineState, {
      type: "SERVICE_INITIALIZED",
      supported: true,
    });

    const erroredState = reduceFileStorageState(supportedState, {
      type: "ERROR_REPORTED",
      error: { message: "Autosave failed", timestamp: Date.now() },
    });

    expect(erroredState.lifecycle).toBe("error");
    expect(erroredState.lastError?.message).toBe("Autosave failed");

    const recoveredState = reduceFileStorageState(erroredState, {
      type: "STATUS_CHANGED",
      status: baseStatus({ status: "running", permissionStatus: "granted" }),
    });

    expect(recoveredState.lifecycle).toBe("ready");
    expect(recoveredState.lastError).toBeNull();
  });
});
