# CMSNext Roadmap - December 2025

**Report Date:** December 16, 2025  
**Branch:** main (stable)  
**Tests:** 537/537 passing ✅  
**Build:** Production-ready ✅  
**Average Feature Rating:** 84/100

---

## 🎯 December Objectives

1. **Code Quality** - Eliminate anti-patterns, enforce hook size limits
2. **Feature Completion** - Ship 6-10 new features across 3 weeks
3. **Testing & Polish** - Maintain 100% test pass rate, improve coverage

---

## 📅 Weekly Plan

### Week 1: Foundation & Financial Features (Dec 2-8) ✅ COMPLETE

#### Prep Work

- [x] Refactor 4 oversized hooks (useNavigationFlow, useConnectionFlow, useCaseManagement, useAlertsFlow)
- [x] Extract CaseOperationsService for business logic separation
- [x] PR #87 merged to main
- [x] FinancialItemModal refactor → `useFinancialItemFlow` hook
- [x] Fix Category Manager checkbox reset bug (countsAsCompleted)
- [x] Refactor NotesDrawer to use shadcn Drawer component (was custom CSS transform implementation)

#### Features

- [x] AVS Import UI in Financials tab
- [x] Bulk case list actions (multi-select delete/status change)
- [x] Filter/sort persistence with localStorage and reset button
- [x] Navigate to case details after creating new case
- [x] Skeleton case auto-creation from unmatched alert imports (with proper name casing)
- [x] Dashboard cleanup - removed AlertCenter and RecentCases widgets (Activity Log only)
- [x] Refresh Case Summary Generator with configurable section modal and plain-text export
- [x] Click-to-copy on financial cards (uses same format as Case Summary)
- [x] Financial card UX: show copy/delete on hover, status dropdown outside click area, auto-save status

#### Polish Work (Dec 5)

- [x] UI consistency audit - aria-labels, button sizes, icon margins, color standardization
- [x] EmptyState component for consistent empty state messaging
- [x] Replace browser confirm() with AlertDialog in Settings
- [x] Unified CopyButton component (replaced McnCopyControl + CopyableText)
- [x] CaseDetails header enhancements: App Date, Phone, Email with click-to-copy
- [x] Priority toggle star button in case header
- [x] Alerts indicator moved to right side of header
- [x] Financial category copy button (copy all items in Resources/Income/Expenses)
- [x] 347 tests passing

#### Bug Fixes & Enhancements (Dec 8)

- [x] Fix AVS import data mapping - normalize account types to title case, remove notes
- [x] Fix AVS parser multi-account detection for bank-specific "Account Owner:" format
- [x] Fix GitHub Pages deployment base path (/CMSNext/)
- [x] AVS import duplicate detection - match by accountNumber + description
- [x] AVS import preview checkboxes - select/deselect individual accounts
- [x] AVS import New/Update badges on preview cards
- [x] AVS import Select All/Deselect All toggle
- [x] 355 tests passing (+8 new tests)

#### Refactoring & Polish

- [x] Update feature catalogue with new features
- [x] All features committed and merged to main
- [x] Phone number formatting in Case Summary Generator
- [x] Financial card layout fixes (CSS grid, CardHeader override)

**Week 1 complete!**

---

### Week 2: Reporting & Analytics (Dec 9-15)

#### Prep Work

- [x] Fix AVS import bugs discovered from Week 1 (data mapping, multi-account detection)
- [x] Add AVS duplicate detection with update capability

#### Features

- [x] Historical financial tracking (amount history modal with dated entries + verification per entry)
- [x] Financial card inline edit mode (swap card display to form, edit button in floating actions)
- [x] Notes button moved to case header (next to alerts)
- [x] Alerts badge overlay (count or green checkmark when all resolved)
- [x] CopyButton tooltip prop (optional hover tooltip, used for App Date 90-day calculation)
- [x] Global context menu with Go To navigation submenu (platform-aware shortcuts)

#### Bug Fixes

- [x] Fix timezone shift in financial history date display (dates showing one day earlier)

#### Dec 11 - Polish & New Features

- [x] Disabled verification source field uses native shadcn Input styling
- [x] Removed Undo/Redo from global context menu (not needed for single-file app)
- [x] Financial form accepts 0 as valid amount (creates history entry for $0 amounts)
- [x] History modal delete button moved inside with "Delete Item" destructive button
- [x] History button added to FinancialItemCardActions (CalendarDays icon)
- [x] FinancialItemCard.test.tsx rewritten using real components (per testing guidelines)
- [x] **NotesPopover**: Replaced NotesDrawer with lightweight popover UI
  - Click-to-edit inline notes
  - Category dropdown in add/edit forms
  - Quick-add with Ctrl/⌘+Enter keyboard shortcut
  - Pencil icon edit button on hover
- [x] Financial card date shows most recent history entry date (not dateAdded)
- [x] Auto-migration for legacy items without history (uses dateAdded as start date)
- [x] Fixed migration date format to YYYY-MM-DD (was using ISO timestamps)

#### Refactoring & Polish

- [x] Add unit tests for Week 2 features (77 new tests: financialHistory, FinancialsService, AmountHistoryModal)
- [x] Refactor CaseList.test.tsx to integration testing pattern

---

### Week 3: Encryption & UX Polish (Dec 15-22)

#### Phase 1: File Encryption (Dec 15) ✅ COMPLETE

**Goal:** Password-based encryption at rest using Web Crypto API

- [x] Create `utils/encryption.ts` - AES-256-GCM encryption service
  - `deriveKey(password, salt)` - PBKDF2 with 100k iterations
  - `encrypt(data, key)` / `decrypt(payload, key)`
- [x] Create `types/encryption.ts` - type definitions
- [x] Create `EncryptionContext.tsx` - encryption state management
- [x] Create encryption file hooks in `useEncryptionFileHooks.ts`
- [x] Modify `AutosaveFileService` - add `checkFileEncryptionStatus()` method
- [x] Split connection modal into `WelcomeModal` + `LoginModal`
  - WelcomeModal: First-time users get welcoming onboarding flow
  - LoginModal: Returning users see instant password prompt
- [x] Create `AuthBackdrop` component for polished modal presentation
- [x] Password never stored; derived key exists only in memory
- [x] Add unit tests for encryption service
- [x] Update documentation (README, feature catalogue)
- [x] 506 tests passing

#### Phase 2: Settings Refactor ✅ COMPLETE

**Goal:** Reduce Settings.tsx from 698 → ~450 lines

- [x] Create `useAlertsCsvImport` hook - extract CSV import with file handling
- [x] Update Settings.tsx to use new hook
- [x] Remove Data Purge functionality (no longer needed)
- [x] Settings.tsx reduced from 698 → 538 lines

#### Phase 3: VR Generator (Dec 16-17) ✅ COMPLETE

**Goal:** Generate Verification Request letters for financial items using reusable templates

- [x] Create `types/vr.ts` - VRScript type with id, name, template, timestamps
- [x] Create `utils/vrGenerator.ts` - letter generation with placeholder support
  - `getPlaceholdersByCategory()` - organized placeholder definitions
  - `createDefaultVRScript()` - factory for new VR scripts
  - `renderVRTemplate()` - placeholder substitution with case/financial data
- [x] Create `hooks/useVRGenerator.ts` - VR generation flow hook
- [x] Create `components/category/VRScriptsEditor.tsx` - VR template management
  - View/edit mode toggle for saved scripts
  - Full template editor with placeholder palette
  - Create, edit, delete operations with validation
  - Collapse/expand with read-only preview
- [x] Add "VR Scripts" tab to CategoryManager settings
- [x] Add special handling in CategoryConfigContext for vrScripts persistence
- [x] Add `updateVRScripts()` method to CategoryConfigService and DataManager
- [x] Add unit tests for vrGenerator (31 new tests)
- [x] Test coverage: placeholders, template rendering, script CRUD
- [x] VR Generator UX improvements:
  - Explicit + button to add scripts (no auto-population)
  - Case-level placeholder filling without items selected
  - Append scripts with separator for multiple additions
- [x] Background alert write queue for reliable persistence
  - Writes continue when user closes drawer or navigates away
  - Optimistic UI updates with fire-and-forget pattern
  - Error toast only on actual write failure
- [x] Paper Cut feedback system (Ctrl+B / ⌘+B)
  - Quick friction logging modal with context capture
  - localStorage persistence with export/clear in Settings
  - Auto-captures current route and nearest UI context
  - PaperCutsPanel in Settings for review and management

#### Phase 4: Keyboard Shortcuts (Dec 17-20)

**Goal:** Customizable keyboard navigation with chord support and settings panel

- [x] Paper Cut moved to `Ctrl+Shift+B` to avoid sidebar conflict
- [ ] Create `types/keyboardShortcuts.ts` - ShortcutDefinition, ShortcutConfig types
- [ ] Create `utils/keyboardShortcuts.ts` - default shortcuts, parsing, display formatting
  - Navigation chords: `Ctrl+G → D` (dashboard), `Ctrl+G → L` (list), `Ctrl+G → S` (settings)
  - Actions: `Ctrl+N` (new case), `/` (search), `?` (help)
  - UI: `Ctrl+B` (toggle sidebar)
- [ ] Create `utils/shortcutStorage.ts` - localStorage persistence for custom bindings
- [ ] Create `hooks/useKeyboardShortcuts.ts` - global handler with chord state machine
- [ ] Create `components/common/KeyboardShortcutsHelp.tsx` - help modal (`?` to open)
- [ ] Create `components/settings/KeyboardShortcutsPanel.tsx` - customize bindings in Settings
- [ ] Wire up shortcuts in App.tsx with central registration
- [ ] Add unit tests for shortcut handler

#### Polish (Dec 21-22)

- [ ] Optimize large case list rendering
- [ ] Clean up deprecated code paths
- [ ] Create December changelog
- [ ] Update feature catalogue ratings
- [ ] Plan January roadmap

---

### Week 4: Holiday Break (Dec 23-31) 🎄

**Off** - No planned development. Emergency fixes only if needed.

---

## 📊 Success Metrics

| Metric                        | Start | Week 1 | Week 2 | Week 3 | Target |
| ----------------------------- | ----- | ------ | ------ | ------ | ------ |
| Hooks over 200 lines          | 4     | 0 ✅   | 0      | 0      | 0      |
| Components with anti-patterns | 1     | 0 ✅   | 0      | 0      | 0      |
| Test count                    | 253   | 355 ✅ | 455 ✅ | 537 ✅ | 550+   |
| New features shipped          | -     | 18 ✅  | 12 ✅  | 3 ✅   | 35+    |
| Average feature rating        | 76.5  | 80 ✅  | 83 ✅  | 84 ✅  | 85+    |

---

## 🔴 Priority by Week

### Week 1 - P0 ✅ ALL COMPLETE

1. ~~Hook refactoring~~ ✅
2. ~~FinancialItemModal anti-pattern fix~~ ✅
3. ~~Category Manager checkbox bug~~ ✅
4. ~~Bulk case list actions~~ ✅
5. ~~Filter/sort persistence~~ ✅
6. ~~Navigate to case details after new case~~ ✅
7. ~~Skeleton case creation from alerts~~ ✅
8. ~~Dashboard widget cleanup~~ ✅
9. ~~Case Summary Generator with modal~~ ✅
10. ~~Financial card copy button~~ ✅
11. ~~Financial card UX polish~~ ✅
12. ~~Phone number formatting~~ ✅

### Week 2 - P0 ✅ ALL COMPLETE

1. ~~Historical financial tracking~~ ✅
2. ~~Financial card inline edit mode~~ ✅
3. ~~Notes button in case header~~ ✅
4. ~~Alerts badge overlay~~ ✅
5. ~~Global context menu~~ ✅
6. ~~NotesPopover~~ ✅

### Week 3 - P0

1. ~~File encryption (AES-256-GCM)~~ ✅
2. ~~Settings refactor~~ ✅
3. ~~VR Generator~~ ✅
4. Keyboard shortcuts

---

## 🚫 Out of Scope (January+)

- Visual regression testing setup
- Release automation
- Real-time collaboration
- Mobile responsive overhaul
- Multi-user support

---

## 📝 Notes

### AI-Assisted Development Model

This roadmap reflects our accelerated development pace with direct AI assistance:

- **Traditional estimate:** 1-2 features per week
- **AI-assisted reality:** 4+ features per week with full test coverage
- **Each week includes:** prep work, features, then refactoring/polish

### Quality Gates

Every feature must:

1. Pass all existing tests
2. Include tests for new functionality
3. Follow established patterns (hooks delegate to services)
4. Be documented in feature catalogue

---

**Prepared by:** GitHub Copilot  
**Last updated:** December 16, 2025
