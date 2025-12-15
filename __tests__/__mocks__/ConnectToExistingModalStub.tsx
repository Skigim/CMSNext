type AsyncButtonHandler = (() => Promise<unknown>) | (() => unknown);

export interface ConnectToExistingModalStubProps {
  isOpen: boolean;
  isSupported: boolean;
  permissionStatus?: "granted" | "denied" | "prompt" | "unknown";
  hasStoredHandle?: boolean;
  onConnectionComplete: AsyncButtonHandler;
  onGoToSettings: AsyncButtonHandler;
}

function callHandler(handler: AsyncButtonHandler | undefined): Promise<unknown> | undefined {
  if (!handler) return;
  const result = handler();
  if (result instanceof Promise) {
    return result;
  }
  return Promise.resolve(result);
}

export default function ConnectToExistingModalStub(props: ConnectToExistingModalStubProps) {
  const {
    isOpen,
    isSupported,
    permissionStatus = "unknown",
    hasStoredHandle = false,
    onConnectionComplete,
    onGoToSettings,
  } = props;

  if (!isOpen) {
    return null;
  }

  if (!isSupported) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Browser Not Supported"
        data-testid="connect-modal"
      >
        <p>Browser Not Supported</p>
        <button type="button" onClick={() => callHandler(onGoToSettings)}>
          Go to Settings
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect to Your Data"
      data-testid="connect-modal"
    >
      {permissionStatus === "denied" && (
        <p>Permission was previously denied. You'll need to grant permission to continue.</p>
      )}

      {hasStoredHandle && (
        <button type="button" onClick={() => callHandler(onConnectionComplete)}>
          Connect to Previous Folder
        </button>
      )}

      <button type="button" onClick={() => callHandler(onConnectionComplete)}>
        Choose Data Folder
      </button>

      <button type="button" onClick={() => callHandler(onGoToSettings)}>
        Go to Settings
      </button>
    </div>
  );
}
