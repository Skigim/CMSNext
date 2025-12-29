import type { ResolvedShortcut, ShortcutConfig, ShortcutDefinition } from "@/types/keyboardShortcuts";

/**
 * Keyboard Shortcut Definitions and Resolution
 * =============================================
 * Defines built-in keyboard shortcuts and resolves shortcut bindings.
 * Handles parsing, validation, and binding resolution for global shortcuts.
 * 
 * ## Shortcut Categories
 * 
 * - **Navigation**: Route navigation (Ctrl+G for chord, then D for Dashboard)
 * - **Actions**: New case, focus search, toggle sidebar, etc.
 * - **Help**: Show help and keyboard shortcut reference
 * - **Utilities**: Paper cut capture, etc.
 * 
 * ## Platform Support
 * 
 * Automatically handles platform differences (Ctrl vs Cmd on Mac).
 * 
 * @module keyboardShortcuts
 */

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // Navigation (chord: ctrl+g then key)
  { id: "goToDashboard", label: "Go to Dashboard", category: "navigation", defaultBinding: "ctrl+g d", enabled: true },
  { id: "goToCaseList", label: "Go to Case List", category: "navigation", defaultBinding: "ctrl+g l", enabled: true },
  { id: "goToSettings", label: "Go to Settings", category: "navigation", defaultBinding: "ctrl+g s", enabled: true },

  // Actions
  { id: "newCase", label: "New Case", category: "actions", defaultBinding: "ctrl+n", enabled: true },
  { id: "focusSearch", label: "Focus Search", category: "actions", defaultBinding: "/", enabled: true },
  { id: "paperCut", label: "Report Paper Cut", category: "actions", defaultBinding: "ctrl+shift+b", enabled: true },
  { id: "showHelp", label: "Show Keyboard Shortcuts", category: "actions", defaultBinding: "?", enabled: true },

  // UI
  { id: "toggleSidebar", label: "Toggle Sidebar", category: "ui", defaultBinding: "ctrl+b", enabled: true },
];

function normalizeToken(token: string): string {
  const t = token.trim().toLowerCase();
  if (t === "cmd") return "meta";
  if (t === "command") return "meta";
  return t;
}

function splitChord(binding: string): { first: string; second?: string } {
  const parts = binding
    .trim()
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return { first: parts[0], second: parts[1] };
  }

  return { first: parts[0] ?? "" };
}

export function parseBinding(binding: string): {
  modifiers: string[];
  key: string;
  isChord: boolean;
  chordKey?: string;
} {
  const trimmed = binding.trim();
  if (!trimmed) return { modifiers: [], key: "", isChord: false };

  const { first, second } = splitChord(trimmed);
  const isChord = Boolean(second);

  const firstParts = first
    .split("+")
    .map((p) => normalizeToken(p))
    .filter(Boolean);

  // Single binding: e.g. "ctrl+n" or "/" or "?"
  if (!isChord) {
    if (firstParts.length <= 1) {
      return { modifiers: [], key: firstParts[0] ?? "", isChord: false };
    }

    return {
      modifiers: firstParts.slice(0, -1),
      key: firstParts[firstParts.length - 1] ?? "",
      isChord: false,
    };
  }

  // Chord binding: e.g. "ctrl+g d"
  const chordKey = firstParts[firstParts.length - 1] ?? "";
  const modifiers = firstParts.slice(0, -1);
  const key = normalizeToken(second ?? "");

  return { modifiers, key, isChord: true, chordKey };
}

export function resolveShortcuts(config: ShortcutConfig): ResolvedShortcut[] {
  return DEFAULT_SHORTCUTS.map((def) => {
    const override = config.shortcuts[def.id];
    const binding = override?.customBinding ?? def.defaultBinding;
    const enabled = override?.enabled ?? def.enabled;

    return {
      ...def,
      enabled,
      binding,
    };
  });
}

export function formatBindingForDisplay(binding: string, isMac: boolean): string {
  const parsed = parseBinding(binding);
  if (!parsed.key) return "";

  const modLabel = (mod: string): string => {
    const m = normalizeToken(mod);
    if (m === "ctrl") return isMac ? "⌘" : "Ctrl";
    if (m === "meta") return "⌘";
    if (m === "shift") return "Shift";
    if (m === "alt" || m === "option") return isMac ? "⌥" : "Alt";
    return m;
  };

  const formatKey = (k: string) => {
    const key = k.trim();
    if (key.length === 1) return key.toUpperCase();
    return key;
  };

  if (!parsed.isChord) {
    if (parsed.modifiers.length === 0) return formatKey(parsed.key);

    const mods = parsed.modifiers.map(modLabel);
    const key = formatKey(parsed.key);

    // For symbol bindings (like "/" or "?"), avoid inserting "+" between mods and key when using glyph mods.
    const usesGlyph = mods.some((m) => m === "⌘" || m === "⌥");
    if (usesGlyph) return `${mods.join("")}${key}`;

    return `${mods.join("+")}+${key}`;
  }

  const chordPrefixParts = [...parsed.modifiers.map(modLabel), formatKey(parsed.chordKey ?? "")].filter(Boolean);
  const chordPrefix = chordPrefixParts.some((p) => p === "⌘" || p === "⌥")
    ? chordPrefixParts.join("")
    : chordPrefixParts.join("+");

  return `${chordPrefix} → ${formatKey(parsed.key)}`;
}
