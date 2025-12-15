# CMSNext Roadmap - December 2025

**Report Date:** December 11, 2025  
**Branch:** main (stable)  
**Tests:** 455/455 passing ✅  
**Build:** Production-ready ✅  
**Average Feature Rating:** 83/100

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

### Week 3: UX Improvements & Automation (Dec 16-22)

#### Prep Work ✅

- [x] Address accessibility issues from Week 2 (focus-within, aria-labels)
- [x] Run tests and build verification (455 tests passing)
- [x] Plan feature implementation approach

#### Phase 1: Settings Refactor (Dec 15)

**Goal:** Reduce Settings.tsx from 698 → ~450 lines

- [ ] Create `useDataPurge` hook (~40 lines) - extract purge logic with `isPurging` state
- [ ] Create `useAlertsCsvImport` hook (~60 lines) - extract CSV import with file handling
- [ ] Update Settings.tsx to use new hooks
- [ ] Add unit tests for both hooks

#### Phase 2: File Encryption (Dec 16-17)

**Goal:** Password-based encryption at rest using Web Crypto API

- [ ] Create `utils/encryption.ts` - AES-256-GCM encryption service
  - `deriveKey(password, salt)` - PBKDF2 with 100k+ iterations
  - `encrypt(data, key)` / `decrypt(payload, key)`
- [ ] Create `types/encryption.ts` - type definitions
- [ ] Modify `AutosaveFileService` - add encryption hooks in read/write paths
- [ ] Modify `FileStorageContext` - encryption state management
- [ ] Create password setup modal (first-time encryption)
- [ ] Create password entry modal (on encrypted file load)
- [ ] Add encryption toggle in Settings
- [ ] Add unit tests for encryption service

#### Phase 3: VR Generator (Dec 18-19)

**Goal:** Generate Verification Request letters for financial items

- [ ] Create `types/vr.ts` - VRRecipient, VRLineItem, GeneratedVR types
- [ ] Create `utils/vrGenerator.ts` - letter generation (follow caseSummaryGenerator pattern)
  - `groupItemsByRecipient(financials)` - group VR-pending items by institution
  - `generateVRLetter(case, recipient)` - template-based letter text
- [ ] Create `hooks/useVRGenerator.ts` - VR generation flow hook
- [ ] Create `components/case/VRGeneratorModal.tsx` - UI with item selection, preview, copy
- [ ] Add "Generate VRs" button to CaseDetails header
- [ ] Add unit tests for generator and hook

#### Phase 4: Keyboard Shortcuts (Dec 20-21)

**Goal:** Gmail/GitHub-style keyboard navigation with chord support

- [ ] Create `utils/keyboardShortcuts.ts` - shortcut definitions
  - Navigation: `g+d` (dashboard), `g+l` (list), `g+r` (reports), `g+s` (settings)
  - Actions: `n` (new case), `/` (search), `?` (help)
  - List: `j/k` (up/down), `Enter` (open)
- [ ] Create `hooks/useKeyboardShortcuts.ts` - global handler with chord state
- [ ] Create `components/common/KeyboardShortcutsHelp.tsx` - help modal
- [ ] Wire up shortcuts in App.tsx
- [ ] Update GlobalContextMenu with shortcut hints
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
| Test count                    | 253   | 355 ✅ | 455 ✅ | 475    | 475+   |
| New features shipped          | -     | 18 ✅  | 12 ✅  | 4      | 30+    |
| Average feature rating        | 76.5  | 80 ✅  | 83 ✅  | 85     | 85+    |

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

### Week 2 - P0

1. Case timeline view
2. Export functionality
3. Dashboard analytics widget
4. Financial summary report

### Week 3 - P0

1. Keyboard shortcuts
2. Case templates
3. Alert auto-assignment
4. Notes search

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
**Last updated:** December 11, 2025
