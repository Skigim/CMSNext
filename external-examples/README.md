# External Examples & Alert Parser Plan

This folder captures the raw Nightingale "stacked" alert CSV export and sketches how we're trimming the importer down while we iterate locally.

## Contents

- `Alerts Sample.txt` – direct export from the Nightingale alert workbook. Each alert row follows the exact column ordering we observed in production: `Due Date`, optional `Display Date`, `MC#`, `Name`, `Program`, `Type`, `Description`, `Alert_Number`.

## Simplified Parser Plan

1. **Treat the file as CSV with a fixed schema** – no more broad regex. Split on newlines, skip the headers/tail summary, and use a CSV-aware splitter (e.g., `csvParser.ts`) so commas inside the name column stay intact.
2. **Map columns to alert fields**
   - Due date → ISO string (`2025-10-28T00:00:00.000Z` style)
   - MCN → normalize via `normalizeMcn`
   - Name → trim, flip `Last, First` → `First Last`
   - Program / Type / Description / Alert Number → direct
3. **Construct `AlertWithMatch` objects** with the minimal metadata (status `"new"`, severity inferred from type/description, `source: "Import"`).
4. **Reuse the existing downstream plumbing**
   - Case matching via `buildCaseMap`
   - Deduplication via `buildAlertStorageKey` + `mergeDuplicateAlerts`
   - Summary/index generation through `createAlertsIndexFromAlerts`

## Next Steps

- Replace `STACKED_ALERT_REGEX` and the `matchAll` loop with the column-based parser.
- Add a focused unit test that feeds `Alerts Sample.txt` through the new parser and asserts the five structured alerts. 
- Retire any now-unused helpers (e.g., `decodeStackedValue`, `normalizeStackedDate`) once the refactor lands.

> **Note:** Keep the simple parser isolated so other import formats (if they ever show up) can supply their own extractor without touching the shared dedupe/index code.
