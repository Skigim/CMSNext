export interface FileStorageStatus {
  status: string;
  message: string;
  timestamp: number;
  permissionStatus?: string;
  lastSaveTime?: number | null;
  consecutiveFailures?: number;
  pendingWrites?: number;
}

export type FileStorageLifecycleState =
  | 'uninitialized'
  | 'unsupported'
  | 'idle'
  | 'requestingPermission'
  | 'ready'
  | 'saving'
  | 'blocked'
  | 'recovering'
  | 'error';

export type FileStoragePermissionState = 'unknown' | 'prompt' | 'granted' | 'denied';

export interface FileStorageErrorInfo {
  message: string;
  type?: string;
  timestamp: number;
}

export interface FileStorageMachineState {
  lifecycle: FileStorageLifecycleState;
  permissionStatus: FileStoragePermissionState;
  isSupported: boolean | undefined;
  hasStoredHandle: boolean;
  isConnected: boolean;
  explicitlyConnected: boolean;
  statusSnapshot: FileStorageStatus | null;
  lastError: FileStorageErrorInfo | null;
  lastSaveTime: number | null;
  consecutiveFailures: number;
  pendingWrites: number;
}

export type FileStorageAction =
  | { type: 'SERVICE_INITIALIZED'; supported: boolean }
  | { type: 'SERVICE_RESET' }
  | { type: 'STATUS_CHANGED'; status: FileStorageStatus }
  | { type: 'CONNECT_REQUESTED' }
  | { type: 'CONNECT_COMPLETED' }
  | { type: 'CONNECT_CONFIRMED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'DISCONNECTED' }
  | { type: 'ERROR_REPORTED'; error: FileStorageErrorInfo };

export const initialMachineState: FileStorageMachineState = {
  lifecycle: 'uninitialized',
  permissionStatus: 'unknown',
  isSupported: undefined,
  hasStoredHandle: false,
  isConnected: false,
  explicitlyConnected: false,
  statusSnapshot: null,
  lastError: null,
  lastSaveTime: null,
  consecutiveFailures: 0,
  pendingWrites: 0,
};

function normalizePermissionStatus(permission: string | undefined): FileStoragePermissionState {
  if (permission === 'granted' || permission === 'denied' || permission === 'prompt') {
    return permission;
  }
  return 'unknown';
}

function computeHasStoredHandle(status: FileStorageStatus, permissionStatus: FileStoragePermissionState): boolean {
  if (status.status === 'disconnected') {
    return false;
  }

  return permissionStatus === 'granted' || permissionStatus === 'prompt';
}

function isReadyState(baseState: FileStorageMachineState, permissionStatus: FileStoragePermissionState): boolean {
  return baseState.explicitlyConnected && permissionStatus === 'granted';
}

function deriveLifecycle(
  baseState: FileStorageMachineState,
  status: FileStorageStatus,
  permissionStatus: FileStoragePermissionState,
): FileStorageLifecycleState {
  if (baseState.isSupported === false) {
    return 'unsupported';
  }

  const ready = isReadyState(baseState, permissionStatus);

  switch (status.status) {
    case 'initialized':
    case 'stopped':
      return ready ? 'ready' : 'idle';
    case 'connected':
      return 'ready';
    case 'running':
      if (ready) return 'ready';
      return baseState.lifecycle === 'requestingPermission' ? 'requestingPermission' : 'idle';
    case 'waiting':
      if (permissionStatus === 'denied') return 'blocked';
      return ready ? 'ready' : 'idle';
    case 'saving':
      return 'saving';
    case 'retrying':
      return permissionStatus === 'denied' ? 'blocked' : 'recovering';
    case 'disconnected':
      return 'idle';
    case 'error':
      return 'error';
    default:
      return baseState.lifecycle;
  }
}

function deriveConnectionState(
  state: FileStorageMachineState,
  status: FileStorageStatus,
  permissionStatus: FileStoragePermissionState,
): Pick<FileStorageMachineState, 'explicitlyConnected' | 'isConnected' | 'hasStoredHandle'> {
  let explicitlyConnected = state.explicitlyConnected;
  let isConnected = state.isConnected;

  if (permissionStatus === 'denied' || status.status === 'disconnected') {
    explicitlyConnected = false;
    isConnected = false;
  } else if (explicitlyConnected) {
    isConnected =
      permissionStatus === 'granted' &&
      status.status !== 'disconnected' &&
      status.status !== 'error';
  }

  return {
    explicitlyConnected,
    isConnected,
    hasStoredHandle: computeHasStoredHandle(status, permissionStatus),
  };
}

function applyStatusChange(state: FileStorageMachineState, status: FileStorageStatus): FileStorageMachineState {
  const permissionStatus = normalizePermissionStatus(status.permissionStatus);
  const { explicitlyConnected, isConnected, hasStoredHandle } = deriveConnectionState(
    state,
    status,
    permissionStatus,
  );

  const baseState: FileStorageMachineState = {
    ...state,
    explicitlyConnected,
    hasStoredHandle,
  };

  const lifecycle = deriveLifecycle(baseState, status, permissionStatus);

  const nextState: FileStorageMachineState = {
    ...baseState,
    lifecycle,
    permissionStatus,
    isConnected,
    statusSnapshot: status,
    lastSaveTime: status.lastSaveTime ?? null,
    consecutiveFailures: status.consecutiveFailures ?? 0,
    pendingWrites: status.pendingWrites ?? 0,
  };

  if (status.status !== 'error' && state.lastError) {
    nextState.lastError = null;
  }

  return nextState;
}

export function reduceFileStorageState(state: FileStorageMachineState, action: FileStorageAction): FileStorageMachineState {
  switch (action.type) {
    case 'SERVICE_INITIALIZED':
      if (!action.supported) {
        return { ...state, lifecycle: 'unsupported', isSupported: false };
      }
      return {
        ...state,
        lifecycle: state.lifecycle === 'uninitialized' ? 'idle' : state.lifecycle,
        isSupported: true,
      };
    case 'SERVICE_RESET':
      return {
        ...initialMachineState,
        isSupported: state.isSupported,
      };
    case 'CONNECT_REQUESTED':
      return { ...state, lifecycle: 'requestingPermission' };
    case 'CONNECT_CONFIRMED':
      return {
        ...state,
        explicitlyConnected: true,
        isConnected: state.permissionStatus === 'granted' ? true : state.isConnected,
      };
    case 'CONNECT_COMPLETED':
      if (state.explicitlyConnected) {
        return state;
      }
      return {
        ...state,
        lifecycle: state.lifecycle === 'requestingPermission' ? 'idle' : state.lifecycle,
      };
    case 'PERMISSION_DENIED':
      return {
        ...state,
        lifecycle: 'blocked',
        permissionStatus: 'denied',
        explicitlyConnected: false,
        isConnected: false,
        hasStoredHandle: false,
      };
    case 'DISCONNECTED':
      return {
        ...state,
        lifecycle: 'idle',
        explicitlyConnected: false,
        isConnected: false,
        hasStoredHandle: false,
      };
    case 'ERROR_REPORTED':
      return {
        ...state,
        lastError: action.error,
        lifecycle: action.error.type === 'warning' ? state.lifecycle : 'error',
      };
    case 'STATUS_CHANGED':
      return applyStatusChange(state, action.status);
    default:
      return state;
  }
}

export const readyLifecycleStates: ReadonlySet<FileStorageLifecycleState> = new Set(['ready', 'saving']);
export const blockingLifecycleStates: ReadonlySet<FileStorageLifecycleState> = new Set(['blocked', 'error']);
