# Agent Instructions: Storage Layer

## Overview

CMSNext is 100% local-first with no network storage. The storage layer uses the File System Access API to read/write JSON files directly to the user's device. All data persistence flows through `AutosaveFileService` which handles debouncing and write optimization.

## Key Files

| File                                    | Purpose                               |
| --------------------------------------- | ------------------------------------- |
| `contexts/FileStorageContext.tsx`       | File handle and permission management |
| `contexts/fileStorageMachine.ts`        | State machine for file storage states |
| `utils/services/FileStorageService.ts`  | Read/write operations                 |
| `utils/services/AutosaveFileService.ts` | Debounced autosave logic              |
| `utils/fileDataProvider.ts`             | File API access validation            |
| `types/fileStorage.ts`                  | Storage type definitions              |

## Architecture

```
FileStorageContext (handles/permissions)
    ↓
AutosaveFileService (debouncing)
    ↓
FileStorageService (read/write)
    ↓
File System Access API (browser)
```

**All storage access must go through this stack. Never bypass it.**

## Browser Compatibility

The File System Access API is **Chromium-only** (Chrome, Edge, Opera). Firefox and Safari are not supported.

```typescript
// Check support before attempting file operations
const api = fileDataProvider.getAPI();
if (!api) {
  // Show compatibility prompt
  return;
}
```

## Patterns

### Accessing File API

```typescript
import { fileDataProvider } from "@/utils/fileDataProvider";

// Always validate before use
const api = fileDataProvider.getAPI();
if (!api) {
  // Handle unsupported browser
  showCompatibilityMessage();
  return;
}

// Now safe to use
const handle = await api.showOpenFilePicker();
```

### Reading Data

```typescript
async function readFileData(): Promise<NormalizedFileData> {
  const handle = getFileHandle();
  if (!handle) {
    throw new Error("No file handle available");
  }

  const file = await handle.getFile();
  const text = await file.text();
  const data = JSON.parse(text);

  // Validate format
  if (!isNormalizedFormat(data)) {
    throw new LegacyFormatError("Legacy format not supported");
  }

  return data;
}
```

### Writing Data (through AutosaveFileService)

```typescript
// NEVER write directly - use AutosaveFileService
class AutosaveFileService {
  private debounceMs = 5000; // 5 second debounce
  private bulkDebounceMs = 15000; // 15 seconds during bulk ops

  async save(data: NormalizedFileData): Promise<void> {
    // Debounce logic prevents excessive writes
    this.scheduleWrite(data);
  }
}
```

### Notifying Storage Changes

After any mutation, notify the storage context to trigger UI updates:

```typescript
import { safeNotifyFileStorageChange } from "@/utils/fileStorageNotify";

async function updateCase(id: string, updates: Partial<Case>): Promise<Case> {
  // Perform the update
  const result = await this.service.update(id, updates);

  // Notify UI to refresh
  safeNotifyFileStorageChange();

  return result;
}
```

### File Handle Flow

```typescript
// 1. User picks file (creates handle)
const [fileHandle] = await window.showOpenFilePicker({
  types: [
    {
      description: "CMSNext Data",
      accept: { "application/json": [".json"] },
    },
  ],
});

// 2. Store handle in context
setFileHandle(fileHandle);

// 3. Check permissions
const permission = await fileHandle.queryPermission({ mode: "readwrite" });
if (permission !== "granted") {
  await fileHandle.requestPermission({ mode: "readwrite" });
}

// 4. Now reads/writes work through handle
```

### Error Handling

```typescript
try {
  const data = await readFile();
} catch (error) {
  if (error instanceof LegacyFormatError) {
    // Data format migration needed
    showMigrationPrompt();
  } else if (error.name === "AbortError") {
    // User cancelled file picker - NOT an error
    return;
  } else if (error.name === "NotAllowedError") {
    // Permission denied
    showPermissionPrompt();
  } else {
    // Unknown error
    toast.error("Failed to read file");
  }
}
```

## Data Format

All data uses the v2.0 normalized format:

```typescript
interface NormalizedFileData {
  cases: Case[];
  financials: Financial[];
  notes: Note[];
  alerts: Alert[];
  categoryConfig: CategoryConfig;
  activityLog: ActivityLogEntry[];
}
```

**Legacy nested formats are rejected.** The app requires migration for old data files.

## Autosave Timing

| Scenario            | Debounce   |
| ------------------- | ---------- |
| Normal operation    | 5 seconds  |
| Bulk operations     | 15 seconds |
| User-triggered save | Immediate  |

## Verification

After making storage changes:

1. **Build passes:** `npm run build`
2. **Tests pass:** `npm test`
3. **Manual test:** Create, read, update, delete operations
4. **Autosave works:** Edit and wait for debounce
5. **Handle persistence:** Close and reopen file
6. **Error handling:** Test permission denied, invalid format

## Common Pitfalls

| ❌ Don't                               | ✅ Do                                      |
| -------------------------------------- | ------------------------------------------ |
| Bypass AutosaveFileService             | Always go through autosave layer           |
| Write without debounce                 | Let AutosaveFileService handle timing      |
| Forget `safeNotifyFileStorageChange()` | Call after every mutation                  |
| Treat AbortError as failure            | User cancelled—handle gracefully           |
| Use localStorage/sessionStorage        | Use File System Access API only            |
| Skip permission checks                 | Always verify handle permissions           |
| Cache file data                        | Always read fresh from file                |
| Use nested data format                 | Use normalized v2.0 format only            |
| Support Firefox/Safari                 | Chromium only (show compatibility message) |
