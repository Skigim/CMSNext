type AsyncButtonHandler = (() => Promise<unknown>) | (() => unknown);

export interface ConnectToExistingModalStubProps {
  isOpen: boolean;
  isSupported: boolean;
  permissionStatus?: string;
  hasStoredHandle?: boolean;
  onConnectToExisting: AsyncButtonHandler;
  onChooseNewFolder: AsyncButtonHandler;
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
    onConnectToExisting,
    onChooseNewFolder,
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
        <button type="button" onClick={() => callHandler(onConnectToExisting)}>
          Connect to Previous Folder
        </button>
      )}

      <button type="button" onClick={() => callHandler(onChooseNewFolder)}>
        Choose Data Folder
      </button>

      <button type="button" onClick={() => callHandler(onGoToSettings)}>
        Go to Settings
      </button>
    </div>
  );
}
