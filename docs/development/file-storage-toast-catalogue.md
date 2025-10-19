# File Storage Toast Catalogue

This catalogue tracks the canonical toast copy emitted via `reportFileStorageError` for all
filesystem interactions. Use it as the single source of truth when instrumenting new flows
so copy, tone, and toast identifiers stay uniform across the app.

## General Guidance

- Always invoke `reportFileStorageError` instead of `toast.*` directly for filesystem
  failures. The helper classifies errors, picks the correct message, and logs metadata.
- User cancellations (`AbortError`) are silently ignored by the helper—never show a toast
  when the user closes a picker dialog intentionally.
- When additional context is required, pass it through the `context` option rather than
  mutating the toast message. The helper already provides operation-specific fallbacks.
- Toast identifiers follow the `file-storage-${operation}` pattern to deduplicate repeat
  notifications.

## Toast Reference

| Operation (`FileStorageOperation`) | Default Message | Severity | Typical Trigger(s) | Notes |
| --- | --- | --- | --- | --- |
| `connect` | We couldn’t connect to the data folder. Check permissions and try again. | error | `FileStorageContext.connectToFolder`, connection modal | Includes permission and handle errors raised during a brand-new folder pick. |
| `connectExisting` | We couldn’t reconnect to the data folder. Pick the folder again to continue. | error | `useConnectionFlow.handleConnectToExisting` | Surfaces when stored handles become invalid or permission is revoked. |
| `requestPermission` | Permission denied for the selected directory. Please allow access to continue. | warning | `AutosaveFileService.requestPermission` | Maps to denied prompts triggered from connection flows. |
| `loadExistingData` | We couldn’t load case data from the folder. Reconnect and retry. | error | Data load during connection or imports | DataManager delegates to this when import transformations fail. |
| `readData` | We couldn’t read the data file. Reconnect and try again. | error | `DataManager.readFileData`, `FileStorageContext.statusCallback` | Used for all read failures (including imports). Classification upgrades to warning if permission issues are detected. |
| `writeData` | We couldn’t save your changes to the data folder. Please try again. | error | `DataManager.writeFileData`, autosave flushes | A retry loop may downgrade severity to info when recovery succeeds. Context includes `errorMessage` for telemetry. |
| `autosave` | Autosave failed. We’ll keep retrying in the background. | warning | `AutosaveFileService.performAutosave` | Only emitted when retries exceed the configured threshold. Recoveries clear the toast. |
| `importCases` | Import failed. Check the file and try again. | error | `useImportListeners` (window `fileImportError`) | Custom import handlers should dispatch a `CustomEvent` with `detail` to override the message when specific validation fails. |

## Copy Overrides and Context

- When a more actionable message is available (e.g., “File was modified by another
  process. Please try again.”) pass it as the `fallbackMessage` **only** if it remains on
  brand. Avoid inline concatenation—let the helper manage punctuation and tone.
- Include diagnostic context such as `{ method: 'writeFileData', errorMessage }` so
  `errorReporting` captures the rich metadata without exposing implementation details to
  end users.
- If a flow needs to suppress the toast (for example, the caller already shows UI), pass
  `toast: false` and handle messaging manually. This should be the exception, not the norm.

## Maintenance Checklist

- [x] Autosave + connection flows routed through `reportFileStorageError`.
- [x] `DataManager` read/write/import operations emit standardized toasts.
- [x] Import listeners translate `fileImportError` events via the catalogue.
- [ ] Resilience documentation links back to this catalogue (Phase 3.4).
- [ ] Troubleshooting guide references canonical copy (Phase 3.5).
