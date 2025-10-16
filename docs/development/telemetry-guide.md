# Telemetry Collection Guide

> **Purpose:** Document opt-in telemetry collection patterns, data format, privacy guarantees, and manual collection workflows for development tooling.
>
> **Status:** Foundation established for local-first usage tracking  
> **Privacy Level:** No PII, no sensitive financial data collected

---

## Overview

The CMSNext telemetry system provides **opt-in, local-only collection** of system health metrics and user workflows. All data is stored in `.telemetry/` (gitignored) and can be manually exported for analysis. No data is transmitted to external services without explicit consent.

### Key Principles

✅ **Local-First:** All data stored on device in `.telemetry/` directory  
✅ **Opt-In:** Collection disabled by default; enabled via environment variable or user preference  
✅ **Privacy-Preserving:** Strict validation rules prevent PII (case IDs, financial amounts, personal names)  
✅ **Transparent:** Events are human-readable JSON; data format is documented  
✅ **Manual Export:** No automatic upload; collected data can be exported manually for analysis

---

## Enabling Telemetry Collection

### For Development

Set the environment variable before starting the dev server:

```bash
VITE_ENABLE_TELEMETRY=true npm run dev
```

Or add to `.env.local`:

```plaintext
VITE_ENABLE_TELEMETRY=true
```

### For End Users (Runtime Toggle)

Telemetry can be toggled at runtime via the API:

```typescript
import { setTelemetryEnabled } from "@/utils/telemetryCollector";

// Enable collection
setTelemetryEnabled(true);

// Disable collection
setTelemetryEnabled(false);
```

The preference is persisted to localStorage as `telemetry-enabled`.

### Configuration

| Method | Priority | Behavior |
|--------|----------|----------|
| Environment Variable | Highest | `VITE_ENABLE_TELEMETRY=true` overrides all |
| localStorage | Medium | User preference persists across sessions |
| Default | Lowest | Collection disabled by default |

---

## Data Format

### Event Structure

All telemetry events follow this structure:

```typescript
interface TelemetryEvent {
  sessionId: string;           // Unique session identifier
  timestamp: string;            // ISO 8601 format (e.g., "2025-10-16T14:30:45.123Z")
  eventType: TelemetryEventType; // See event types below
  duration?: number;            // Optional: milliseconds (for performance events)
  metadata?: Record<string, unknown>; // Optional: event-specific data
}
```

### Supported Event Types

#### Storage & Sync

- **`storage-sync-start`** – File sync operation initiated
  ```typescript
  metadata: { operationType: "read" | "write", estimatedSize: number }
  ```

- **`storage-sync-success`** – File sync completed successfully
  ```typescript
  metadata: { operationType: "read" | "write", bytesTransferred: number }
  duration: 234 // milliseconds
  ```

- **`storage-sync-error`** – File sync failed
  ```typescript
  metadata: { operationType: "read" | "write", errorCode: string }
  duration: 89 // milliseconds
  ```

- **`storage-error-recovered`** – Storage error was auto-recovered
  ```typescript
  metadata: { recoveryStrategy: "retry" | "fallback" | "clear_cache" }
  ```

#### Autosave Status

- **`autosave-badge-state-change`** – Autosave badge state transitioned
  ```typescript
  metadata: { fromState: "idle" | "saving" | "saved" | "error", toState: "idle" | "saving" | "saved" | "error" }
  duration: 2500 // milliseconds spent in previous state
  ```

#### Dashboard Performance

- **`dashboard-load-start`** – Dashboard initial load begins
  ```typescript
  metadata: {} // No additional data
  ```

- **`dashboard-load-complete`** – Dashboard fully rendered and ready
  ```typescript
  metadata: { widgetCount: number }
  duration: 1250 // milliseconds from mount to first paint
  ```

#### Data Operations

- **`import-initiated`** – Import operation started
  ```typescript
  metadata: { sourceFormat: "json" | "csv", estimatedRecordCount: number }
  ```

- **`export-initiated`** – Export operation started
  ```typescript
  metadata: { targetFormat: "json" | "csv", recordCount: number }
  ```

- **`case-created`** – New case created
  ```typescript
  metadata: { caseStatus: string, hasFinancialData: boolean }
  ```

- **`case-updated`** – Existing case modified
  ```typescript
  metadata: { fieldsChanged: number, hasFinancialData: boolean }
  ```

- **`case-deleted`** – Case removed
  ```typescript
  metadata: { caseStatus: string }
  ```

- **`financial-item-added`** – Financial item created
  ```typescript
  metadata: { categoryCount: number }
  ```

- **`financial-item-removed`** – Financial item deleted
  ```typescript
  metadata: {} // No details
  ```

- **`note-created`** – Case note added
  ```typescript
  metadata: { wordCount: number, hasAttachments: boolean }
  ```

### Full Event Example

```json
{
  "sessionId": "session-1697461845234-a1b2c3d",
  "timestamp": "2025-10-16T14:30:45.123Z",
  "eventType": "storage-sync-success",
  "duration": 234,
  "metadata": {
    "operationType": "write",
    "bytesTransferred": 5248
  }
}
```

### File Schema

Telemetry events are written to timestamped JSON files in `.telemetry/`:

```typescript
interface TelemetrySchema {
  version: string;        // "1.0"
  sessionId: string;      // Matches all contained events
  startedAt: string;      // ISO 8601 timestamp
  events: TelemetryEvent[]; // Array of collected events
}
```

**Example filename:** `.telemetry/telemetry-session-1697461845234-a1b2c3d.json`

**Example file contents:**

```json
{
  "version": "1.0",
  "sessionId": "session-1697461845234-a1b2c3d",
  "startedAt": "2025-10-16T14:25:12.000Z",
  "events": [
    {
      "sessionId": "session-1697461845234-a1b2c3d",
      "timestamp": "2025-10-16T14:30:45.123Z",
      "eventType": "storage-sync-start",
      "metadata": {
        "operationType": "read",
        "estimatedSize": 8192
      }
    },
    {
      "sessionId": "session-1697461845234-a1b2c3d",
      "timestamp": "2025-10-16T14:30:45.456Z",
      "eventType": "storage-sync-success",
      "duration": 333,
      "metadata": {
        "operationType": "read",
        "bytesTransferred": 8192
      }
    },
    {
      "sessionId": "session-1697461845234-a1b2c3d",
      "timestamp": "2025-10-16T14:31:12.789Z",
      "eventType": "autosave-badge-state-change",
      "duration": 27333,
      "metadata": {
        "fromState": "saving",
        "toState": "saved"
      }
    }
  ]
}
```

---

## Usage Patterns

### In Hooks and Components

Import the collector and emit events:

```typescript
import { collectEvent } from "@/utils/telemetryCollector";

// Simple event with no metadata
collectEvent("case-created");

// Event with metadata
collectEvent("autosave-badge-state-change", {
  fromState: "idle",
  toState: "saving",
});

// Performance event with duration
collectEvent("dashboard-load-complete", { widgetCount: 5 }, 1250);
```

### In Performance-Critical Code

Use with `performanceTracker.ts`:

```typescript
import { startMeasurement, endMeasurement } from "@/utils/performanceTracker";
import { collectEvent } from "@/utils/telemetryCollector";

export function handleStorageSync(operation: "read" | "write") {
  startMeasurement("storage-sync", { operationType: operation });
  collectEvent("storage-sync-start", { operationType: operation });

  try {
    // ... sync operation ...
    const duration = endMeasurement("storage-sync");
    collectEvent("storage-sync-success", { operationType: operation, bytesTransferred: 8192 }, duration);
  } catch (err) {
    collectEvent("storage-sync-error", { operationType: operation, errorCode: "ENOENT" });
  }
}
```

### Checking Current Configuration

```typescript
import { getTelemetryConfig, getSessionId } from "@/utils/telemetryCollector";

const config = getTelemetryConfig();
console.log("Telemetry enabled:", config.enabled);
console.log("Session ID:", getSessionId());
```

### Manual Buffer Flush (Dev Tooling)

```typescript
import { flushEventBuffer, getBufferedEvents } from "@/utils/telemetryCollector";

// Flush buffered events to file (Node.js contexts only)
await flushEventBuffer();

// Get current buffer without writing to file
const events = getBufferedEvents();
console.log(`${events.length} events in buffer`);
```

---

## Privacy & Validation

### PII Prevention Rules

The telemetry collector **automatically rejects events** containing patterns that suggest PII:

❌ **Rejected patterns:** `case_id`, `personId`, `financial_amount`, `SSN`, `email`, `phone`

Example (rejected):

```typescript
// This event will be rejected by the validator
collectEvent("case-created", {
  caseId: "case-12345", // PII pattern detected!
  status: "Open",
});
```

Correct usage:

```typescript
// This event will be accepted
collectEvent("case-created", {
  caseStatus: "Open",    // Aggregate data only
  hasFinancialData: true, // Boolean flags OK
});
```

### Metadata Guidelines

✅ **Safe metadata examples:**
- `status`, `priority`, `type`, `category`
- Aggregate counts: `itemCount`, `recordCount`, `wordCount`
- Boolean flags: `hasAttachments`, `hasFinancialData`
- Duration and performance metrics
- Error codes and recovery strategies

❌ **Unsafe metadata examples:**
- Case IDs, person IDs, financial amounts
- Email addresses, phone numbers, SSNs
- Full names or personal identifiers
- Financial totals or specific amounts
- Sensitive case details

### Validation Process

Every event is validated before collection:

1. **Structure validation:** Required fields present (`sessionId`, `timestamp`, `eventType`)
2. **PII detection:** Metadata scanned for PII patterns
3. **Schema conformity:** Event matches known type schema
4. **Logging:** Invalid events logged as warnings (not added to buffer)

```typescript
// Invalid event rejected with warning log:
// [2025-10-16T14:30:45.123Z] [Telemetry] Telemetry event rejected: potential PII detected
// { patterns: [ 'case[_-]?id' ] }
```

---

## Manual Collection Workflows

### For Developers

**Export current session data:**

```bash
# In dev console:
import { getBufferedEvents, getSessionId } from "@/utils/telemetryCollector"

const sessionId = getSessionId()
const events = getBufferedEvents()
console.log(JSON.stringify({ sessionId, events }, null, 2))

# Copy-paste to file or send to analysis service
```

**Reset collection for new test run:**

```bash
# In dev console:
import { clearEventBuffer, resetTelemetrySession } from "@/utils/telemetryCollector"

await resetTelemetrySession()
console.log("Session reset and ready for new collection")
```

### For End Users (If Sharing Data)

Users can locate collected telemetry files:

**Location:** `.telemetry/` directory in application root

**To export:**
1. Open application data folder
2. Navigate to `.telemetry/`
3. Copy `.json` files to desired location
4. Share with support team via secure channel

**To disable collection:**
- Toggle in app settings: _Settings → Privacy → Telemetry Collection_
- Or localStorage console: `localStorage.setItem("telemetry-enabled", "false")`

---

## Troubleshooting

### Events Not Being Collected

**Symptom:** `getBufferedEvents()` returns empty array

**Diagnostic steps:**

1. **Check if enabled:** `getTelemetryConfig().enabled` should be `true`
2. **Check environment variable:** `echo $VITE_ENABLE_TELEMETRY`
3. **Check localStorage:** `localStorage.getItem("telemetry-enabled")`
4. **Check console logs:** Look for telemetry validation warnings

**Solution:**
```bash
# Enable via environment
export VITE_ENABLE_TELEMETRY=true
npm run dev

# Or enable via console
setTelemetryEnabled(true)
```

### Events Rejected for "Potential PII"

**Symptom:** Warning logs: "potential PII detected"

**Cause:** Event metadata contains PII pattern (e.g., `caseId`, `personId`)

**Solution:** Use aggregate data instead:
```typescript
// ❌ Rejected
collectEvent("case-created", { caseId: "case-123" });

// ✅ Accepted
collectEvent("case-created", { caseStatus: "pending" });
```

### Buffer Not Flushing to File

**Symptom:** Events buffer grows but no `.telemetry/` files created

**Note:** This is expected in browser-only contexts. File writing only occurs in Node.js dev tooling.

**Solution:** Manually export events:
```typescript
const events = getBufferedEvents();
// Share via console or API call
```

---

## Integration with Dev Tooling

### CI/CD Collection

In CI pipelines, enable telemetry to track test performance:

```yaml
# .github/workflows/test.yml
env:
  VITE_ENABLE_TELEMETRY: "true"
```

Retrieve collected events after test run:
```bash
npm run test:export-telemetry  # Custom script to export collected events
```

### Performance Analysis

Combine telemetry with performance baseline:

```typescript
import { performanceTracker } from "@/utils/performanceTracker";
import { getBufferedEvents } from "@/utils/telemetryCollector";

function analyzePerformance() {
  const measurements = performanceTracker.getRecordedMeasurements();
  const telemetryEvents = getBufferedEvents();

  // Compare dashboard load time from both sources
  const dashboardLoad = telemetryEvents.find(e => e.eventType === "dashboard-load-complete");
  console.log(`Dashboard load: ${dashboardLoad?.duration}ms`);
}
```

---

## Next Steps (Post-Foundation)

1. **Track 1 (Telemetry):** Extend `useFileDataSync` and `useAutosaveStatus` to emit events
2. **Track 3 (Dashboard Insights):** Use telemetry timestamps for widget freshness indicators
3. **Usage Analysis:** Build script to parse `.telemetry/` files and generate reports
4. **Backend Integration:** (Future) Connect to optional cloud service for aggregate metrics (with user consent)

---

## References

- **Collector Implementation:** `utils/telemetryCollector.ts`
- **Logger Integration:** `utils/logger.ts`
- **Performance Integration:** `utils/performanceTracker.ts`
- **Environment Config:** `vite.config.ts`
- **Privacy Policy:** Ensure telemetry section aligns with app privacy policy
