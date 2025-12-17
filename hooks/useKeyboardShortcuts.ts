import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResolvedShortcut } from "@/types/keyboardShortcuts";
import { parseBinding, resolveShortcuts } from "@/utils/keyboardShortcuts";
import { getShortcutConfig } from "@/utils/shortcutStorage";

interface UseKeyboardShortcutsOptions {
  onNavigate: (path: string) => void;
  onNewCase: () => void;
  onFocusSearch: () => void;
  onPaperCut: () => void;
  onShowHelp: () => void;
  onToggleSidebar: () => void;
}

type PendingChord = {
  prefix: string;
  startedAt: number;
};

const CHORD_TIMEOUT_MS = 1000;

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = (navigator as any).platform ?? "";
  const userAgent = navigator.userAgent ?? "";
  return /Mac|iPhone|iPad|iPod/i.test(String(platform)) || /Mac|iPhone|iPad|iPod/i.test(userAgent);
}

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

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
  const mods = modifiers.map((m) => m.toLowerCase()).sort();
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

function eventMatchesChordPrefix(event: KeyboardEvent, shortcut: ResolvedShortcut, isMac: boolean): string | null {
  const parsed = parseBinding(shortcut.binding);
  if (!parsed.isChord || !parsed.chordKey) return null;

  const requiredMods = parsed.modifiers.map((m) => m.toLowerCase());
  for (const mod of requiredMods) {
    if (!modifierMatches(mod, event, isMac)) return null;
  }

  // Require exact modifier set for prefix to avoid collisions.
  if (event.shiftKey !== requiredMods.includes("shift")) return null;
  if (event.altKey !== requiredMods.includes("alt")) return null;

  const metaRequired = requiredMods.includes("meta");
  const ctrlRequired = requiredMods.includes("ctrl");

  const ctrlActive = isMac ? event.metaKey : event.ctrlKey;
  const metaActive = event.metaKey;

  if (metaRequired && !metaActive) return null;
  if (!metaRequired && metaActive && !(ctrlRequired && isMac)) return null;
  if (ctrlRequired && !ctrlActive) return null;
  if (!ctrlRequired && ctrlActive && !(metaRequired && !isMac)) return null;

  if (normalizeKey(event.key) !== normalizeKey(parsed.chordKey)) return null;

  return bindingPrefix(parsed.modifiers, parsed.chordKey);
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

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): {
  chordPending: boolean;
  pendingModifier: string | null;
} {
  const isMac = useMemo(() => isMacPlatform(), []);

  const [shortcuts, setShortcuts] = useState<ResolvedShortcut[]>([]);

  const shortcutsRef = useRef<ResolvedShortcut[]>([]);
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const pendingChordRef = useRef<PendingChord | null>(null);
  const chordTimerRef = useRef<number | null>(null);

  const [chordPending, setChordPending] = useState(false);
  const [pendingModifier, setPendingModifier] = useState<string | null>(null);

  const clearChord = useCallback(() => {
    pendingChordRef.current = null;
    setChordPending(false);
    setPendingModifier(null);

    if (chordTimerRef.current) {
      window.clearTimeout(chordTimerRef.current);
      chordTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const config = getShortcutConfig();
    setShortcuts(resolveShortcuts(config));
  }, []);

  const startChord = useCallback(
    (prefix: string) => {
      pendingChordRef.current = { prefix, startedAt: Date.now() };
      setChordPending(true);
      setPendingModifier(prefix);

      if (chordTimerRef.current) {
        window.clearTimeout(chordTimerRef.current);
      }

      chordTimerRef.current = window.setTimeout(() => {
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

      // If currently waiting for chord completion
      if (pending) {
        const elapsed = Date.now() - pending.startedAt;
        if (elapsed > CHORD_TIMEOUT_MS) {
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

        const actionFactory = actionForShortcutId(match.id);
        if (!actionFactory) return;

        event.preventDefault();
        actionFactory(options);
        return;
      }

      // First check: chord prefix initiation (e.g. ctrl+g)
      for (const s of enabled) {
        const prefix = eventMatchesChordPrefix(event, s, isMac);
        if (!prefix) continue;

        event.preventDefault();
        startChord(prefix);
        return;
      }

      // Second check: non-chord shortcuts
      const direct = enabled.find((s) => eventMatchesBinding(event, s.binding, isMac));
      if (!direct) return;

      const actionFactory = actionForShortcutId(direct.id);
      if (!actionFactory) return;

      event.preventDefault();
      actionFactory(options);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [clearChord, isMac, options, startChord]);

  useEffect(() => {
    return () => {
      if (chordTimerRef.current) {
        window.clearTimeout(chordTimerRef.current);
        chordTimerRef.current = null;
      }
    };
  }, []);

  return { chordPending, pendingModifier };
}
