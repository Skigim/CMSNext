import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResolvedShortcut } from "@/types/keyboardShortcuts";
import { parseBinding, resolveShortcuts } from "@/utils/keyboardShortcuts";
import { getShortcutConfig } from "@/utils/shortcutStorage";

/**
 * Keyboard shortcut handler options.
 * @interface UseKeyboardShortcutsOptions
 */
interface UseKeyboardShortcutsOptions {
  /** Called when user navigates with shortcut */
  onNavigate: (path: string) => void;
  /** Called when user opens new case form */
  onNewCase: () => void;
  /** Called when user focuses search */
  onFocusSearch: () => void;
  /** Called when user uses paper cut capture shortcut */
  onPaperCut: () => void;
  /** Called when user opens help */
  onShowHelp: () => void;
  /** Called when user toggles sidebar */
  onToggleSidebar: () => void;
}

/**
 * Pending keyboard chord state.
 * @interface PendingChord
 */
type PendingChord = {
  /** Key prefix accumulated so far (e.g., "ctrl+k") */
  prefix: string;
  /** Timestamp when chord started (for timeout detection) */
  startedAt: number;
};

const CHORD_TIMEOUT_MS = 1000;

/**
 * Check if running on macOS platform.
 * @private
 */
function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = (navigator as any).platform ?? "";
  const userAgent = navigator.userAgent ?? "";
  return /Mac|iPhone|iPad|iPod/i.test(String(platform)) || /Mac|iPhone|iPad|iPod/i.test(userAgent);
}

/**
 * Normalize key name for comparison.
 * @private
 */
function normalizeKey(key: string): string {
  return key.toLowerCase();
}

/**
 * Check if event target is an editable element.
 * @private
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;

  // If focus is inside an editable area
  const editableAncestor = target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']");
  return Boolean(editableAncestor);
}

function bindingPrefix(modifiers: string[], chordKey: string): string {
  const mods = modifiers.map((m) => m.toLowerCase()).sort((a, b) => a.localeCompare(b));
  return `${mods.join("+")}+${chordKey.toLowerCase()}`.replace(/^\+/, "");
}

function modifierMatches(mod: string, event: KeyboardEvent, isMac: boolean): boolean {
  const m = mod.toLowerCase();

  if (m === "ctrl") return isMac ? event.metaKey : event.ctrlKey;
  if (m === "meta") return event.metaKey;
  if (m === "shift") return event.shiftKey;
  if (m === "alt") return event.altKey;

  return false;
}

function isImplicitShiftKey(key: string): boolean {
  // Keys like "?" require Shift but present as "?" in event.key.
  return key === "?";
}

function eventMatchesBinding(event: KeyboardEvent, binding: string, isMac: boolean): boolean {
  const parsed = parseBinding(binding);
  if (!parsed.key || parsed.isChord) return false;

  const requiredMods = new Set(parsed.modifiers.map((m) => m.toLowerCase()));

  for (const mod of requiredMods) {
    if (!modifierMatches(mod, event, isMac)) return false;
  }

  // Prevent subset collisions (ctrl+b vs ctrl+shift+b) by requiring no unexpected modifiers,
  // except for implicit shift when the key itself is shifted punctuation (e.g. "?").
  const allowImplicitShift = !requiredMods.has("shift") && isImplicitShiftKey(parsed.key);

  const unexpectedShift = event.shiftKey && !requiredMods.has("shift") && !allowImplicitShift;
  const unexpectedAlt = event.altKey && !requiredMods.has("alt");
  const unexpectedMeta = event.metaKey && !requiredMods.has("meta") && !(requiredMods.has("ctrl") && isMac);
  const unexpectedCtrl = event.ctrlKey && !requiredMods.has("ctrl") && !(requiredMods.has("meta") && !isMac);

  if (unexpectedShift || unexpectedAlt || unexpectedMeta || unexpectedCtrl) return false;

  return normalizeKey(event.key) === normalizeKey(parsed.key);
}

/**
 * Check that the event's modifier state exactly matches the required set,
 * accounting for macOS Cmd↔Ctrl swaps.
 */
function modifiersMatchExactly(
  event: KeyboardEvent,
  requiredMods: string[],
  isMac: boolean,
): boolean {
  if (event.shiftKey !== requiredMods.includes("shift")) return false;
  if (event.altKey !== requiredMods.includes("alt")) return false;

  const metaRequired = requiredMods.includes("meta");
  const ctrlRequired = requiredMods.includes("ctrl");
  const ctrlActive = isMac ? event.metaKey : event.ctrlKey;

  if (metaRequired && !event.metaKey) return false;
  if (!metaRequired && event.metaKey && !(ctrlRequired && isMac)) return false;
  if (ctrlRequired && !ctrlActive) return false;
  if (!ctrlRequired && ctrlActive && !(metaRequired && !isMac)) return false;

  return true;
}

function eventMatchesChordPrefix(event: KeyboardEvent, shortcut: ResolvedShortcut, isMac: boolean): string | null {
  const parsed = parseBinding(shortcut.binding);
  if (!parsed.isChord || !parsed.chordKey) return null;

  const requiredMods = parsed.modifiers.map((m) => m.toLowerCase());
  for (const mod of requiredMods) {
    if (!modifierMatches(mod, event, isMac)) return null;
  }

  if (!modifiersMatchExactly(event, requiredMods, isMac)) return null;

  if (normalizeKey(event.key) !== normalizeKey(parsed.chordKey)) return null;

  return bindingPrefix(parsed.modifiers, parsed.chordKey);
}

/**
 * Attempt to complete a pending chord sequence.
 * Always consumes the event (returns void) to end the chord.
 */
function tryCompleteChord(
  pending: PendingChord,
  enabled: ResolvedShortcut[],
  event: KeyboardEvent,
  options: UseKeyboardShortcutsOptions,
  clearChord: () => void,
): void {
  if (Date.now() - pending.startedAt > CHORD_TIMEOUT_MS) {
    clearChord();
    return;
  }

  const secondKey = normalizeKey(event.key);
  const match = enabled.find((s) => {
    const parsed = parseBinding(s.binding);
    if (!parsed.isChord || !parsed.chordKey) return false;
    const prefix = bindingPrefix(parsed.modifiers, parsed.chordKey);
    return prefix === pending.prefix && normalizeKey(parsed.key) === secondKey;
  });

  clearChord();
  if (!match) return;

  const factory = actionForShortcutId(match.id);
  if (!factory) return;

  event.preventDefault();
  factory(options);
}

/**
 * Attempt to start a chord prefix from the current event.
 * @returns true if a chord was initiated.
 */
function tryStartChord(
  enabled: ResolvedShortcut[],
  event: KeyboardEvent,
  isMac: boolean,
  startChord: (prefix: string) => void,
): boolean {
  for (const s of enabled) {
    const prefix = eventMatchesChordPrefix(event, s, isMac);
    if (!prefix) continue;
    event.preventDefault();
    startChord(prefix);
    return true;
  }
  return false;
}

/**
 * Attempt to fire a direct (non-chord) shortcut.
 * @returns true if a shortcut was matched and executed.
 */
function tryDirectShortcut(
  enabled: ResolvedShortcut[],
  event: KeyboardEvent,
  isMac: boolean,
  options: UseKeyboardShortcutsOptions,
): boolean {
  const direct = enabled.find((s) => eventMatchesBinding(event, s.binding, isMac));
  if (!direct) return false;

  const factory = actionForShortcutId(direct.id);
  if (!factory) return false;

  event.preventDefault();
  factory(options);
  return true;
}

function actionForShortcutId(id: string): ((opts: UseKeyboardShortcutsOptions) => void) | null {
  switch (id) {
    case "goToDashboard":
      return (o) => o.onNavigate("/dashboard");
    case "goToCaseList":
      return (o) => o.onNavigate("/cases");
    case "goToSettings":
      return (o) => o.onNavigate("/settings");
    case "newCase":
      return (o) => o.onNewCase();
    case "focusSearch":
      return (o) => o.onFocusSearch();
    case "paperCut":
      return (o) => o.onPaperCut();
    case "showHelp":
      return (o) => o.onShowHelp();
    case "toggleSidebar":
      return (o) => o.onToggleSidebar();
    default:
      return null;
  }
}

/**
 * Keyboard shortcuts management hook.
 * 
 * Registers global keyboard shortcuts and calls handlers when activated.
 * Supports single shortcuts (Ctrl+K) and chord shortcuts (Ctrl+K, C).
 * Automatically skips shortcuts when focused on editable elements.
 * 
 * ## Supported Shortcuts
 * 
 * - **Navigate**: Jump to routes (e.g., Ctrl+K, then D for Dashboard)
 * - **New Case**: Create new case (Ctrl+Alt+N)
 * - **Focus Search**: Jump to search box (Ctrl+/)
 * - **Paper Cut**: Capture to clipboard (Ctrl+Shift+C)
 * - **Help**: Show help modal (Ctrl+?)
 * - **Sidebar**: Toggle sidebar (Ctrl+B)
 * 
 * ## Platform Support
 * 
 * Automatically adapts to Mac vs Windows:
 * - Mac: Uses Cmd instead of Ctrl
 * - Windows/Linux: Uses Ctrl
 * 
 * Example: Ctrl+K on Windows → Cmd+K on Mac
 * 
 * ## Chord Shortcuts
 * 
 * Two-key sequences with timeout:
 * 1. User presses Ctrl+K
 * 2. System waits for second key (1000ms timeout)
 * 3. User presses C for Cases view
 * 4. Handler fires for Ctrl+K, C
 * 
 * If timeout expires or user presses Escape, chord resets.
 * 
 * ## Skip Conditions
 * 
 * Shortcuts are disabled when:
 * - Focused on input/textarea/select
 * - Focused on contentEditable element
 * - Modal dialogs open (check via event target)
 * 
 * Prevents accidentally triggering shortcuts while typing.
 * 
 * ## Usage Example
 * 
 * Import the hook and pass callback handlers for each action.
 * The hook returns chord state for UI feedback (showing pending modifier keys).
 * 
 * Usage patterns:
 * - Register handlers in your layout component
 * - Use chordPending and pendingModifier for UI hints
 * - Handlers are called when shortcuts are activated
 * - Shortcuts disabled when focused on input fields or contentEditable elements
 * 
 * ## Return Values
 * 
 * - `chordPending`: Boolean indicating if user has started a chord sequence
 * - `pendingModifier`: First key of chord (e.g., "Ctrl+K"), or null if no chord
 * 
 * Useful for showing UI hint about pending chord state.
 * 
 * ## Configuration
 * 
 * Shortcuts can be customized via localStorage or shortcut config file.
 * Built-in defaults provided for all actions.
 * 
 * @hook
 * @param {UseKeyboardShortcutsOptions} options - Handler functions for each shortcut
 * @returns {{chordPending: boolean, pendingModifier: string | null}} Chord state for UI
 * 
 * @see {@link ResolvedShortcut} for shortcut structure
 * @see {@link getShortcutConfig} for configuration
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): {
  chordPending: boolean;
  pendingModifier: string | null;
} {
  const isMac = useMemo(() => isMacPlatform(), []);

  const [shortcuts] = useState<ResolvedShortcut[]>(() => resolveShortcuts(getShortcutConfig()));

  const shortcutsRef = useRef<ResolvedShortcut[]>(shortcuts);
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const pendingChordRef = useRef<PendingChord | null>(null);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [chordPending, setChordPending] = useState(false);
  const [pendingModifier, setPendingModifier] = useState<string | null>(null);

  const clearChord = useCallback(() => {
    pendingChordRef.current = null;
    setChordPending(false);
    setPendingModifier(null);

    if (chordTimerRef.current) {
      globalThis.clearTimeout(chordTimerRef.current);
      chordTimerRef.current = null;
    }
  }, []);

  const startChord = useCallback(
    (prefix: string) => {
      pendingChordRef.current = { prefix, startedAt: Date.now() };
      setChordPending(true);
      setPendingModifier(prefix);

      if (chordTimerRef.current) {
        globalThis.clearTimeout(chordTimerRef.current);
      }

      chordTimerRef.current = globalThis.setTimeout(() => {
        clearChord();
      }, CHORD_TIMEOUT_MS);
    },
    [clearChord]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.repeat) return;
      if (isEditableTarget(event.target)) return;

      const enabled = shortcutsRef.current.filter((s) => s.enabled);
      const pending = pendingChordRef.current;

      if (pending) {
        tryCompleteChord(pending, enabled, event, options, clearChord);
        return;
      }

      if (tryStartChord(enabled, event, isMac, startChord)) return;
      tryDirectShortcut(enabled, event, isMac, options);
    };

    globalThis.addEventListener("keydown", onKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, [clearChord, isMac, options, startChord]);

  useEffect(() => {
    return () => {
      if (chordTimerRef.current) {
        globalThis.clearTimeout(chordTimerRef.current);
        chordTimerRef.current = null;
      }
    };
  }, []);

  return { chordPending, pendingModifier };
}
