import type { ShortcutConfig, ShortcutDefinition } from "@/types/keyboardShortcuts";
import { DEFAULT_SHORTCUTS } from "@/utils/keyboardShortcuts";

/**
 * Keyboard Shortcut Storage Utilities
 * ===================================
 * Manages persistent storage and retrieval of keyboard shortcut configurations.
 * Allows users to customize keyboard shortcuts with persistence across sessions.
 * 
 * ## Features
 * 
 * - **Load/Save**: Retrieve and persist shortcut configurations
 * - **Defaults**: Fallback to default shortcuts if none saved
 * - **Reset**: Clear custom shortcuts and restore defaults
 * - **Validation**: Ensures shortcut definitions are valid
 * 
 * @module shortcutStorage
 */

const STORAGE_KEY = "keyboard-shortcuts";

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function buildDefaultConfig(definitions: ShortcutDefinition[] = DEFAULT_SHORTCUTS): ShortcutConfig {
  const shortcuts: ShortcutConfig["shortcuts"] = {};
  for (const def of definitions) {
    shortcuts[def.id] = { enabled: def.enabled };
  }
  return { shortcuts };
}

function isShortcutConfig(value: unknown): value is ShortcutConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (!candidate.shortcuts || typeof candidate.shortcuts !== "object") return false;

  const shortcuts = candidate.shortcuts as Record<string, unknown>;
  for (const entry of Object.values(shortcuts)) {
    if (!entry || typeof entry !== "object") return false;
    const e = entry as Record<string, unknown>;
    if (typeof e.enabled !== "boolean") return false;
    if (typeof e.customBinding !== "undefined" && typeof e.customBinding !== "string") return false;
  }

  return true;
}

function safeParseConfig(raw: string | null): ShortcutConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isShortcutConfig(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function mergeWithDefaults(parsed: ShortcutConfig | null): ShortcutConfig {
  const defaults = buildDefaultConfig();
  if (!parsed) return defaults;

  // Merge: keep unknown ids (forward-compatible), but ensure defaults exist.
  return {
    shortcuts: {
      ...defaults.shortcuts,
      ...parsed.shortcuts,
    },
  };
}

export function getShortcutConfig(): ShortcutConfig {
  if (!hasLocalStorage()) return buildDefaultConfig();
  const parsed = safeParseConfig(window.localStorage.getItem(STORAGE_KEY));
  return mergeWithDefaults(parsed);
}

export function saveShortcutConfig(config: ShortcutConfig): void {
  if (!hasLocalStorage()) return;

  // Persist only if shape is valid; otherwise fallback to defaults.
  const next = isShortcutConfig(config) ? config : buildDefaultConfig();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function ensureEntry(id: string, config: ShortcutConfig): void {
  if (config.shortcuts[id]) return;

  const def = DEFAULT_SHORTCUTS.find((s) => s.id === id);
  config.shortcuts[id] = { enabled: def?.enabled ?? true };
}

export function updateShortcutBinding(id: string, binding: string | null): void {
  const config = getShortcutConfig();
  ensureEntry(id, config);

  if (binding === null) {
    delete config.shortcuts[id].customBinding;
  } else {
    config.shortcuts[id].customBinding = binding;
  }

  saveShortcutConfig(config);
}

export function toggleShortcut(id: string, enabled: boolean): void {
  const config = getShortcutConfig();
  ensureEntry(id, config);
  config.shortcuts[id].enabled = enabled;
  saveShortcutConfig(config);
}

export function resetAllShortcuts(): void {
  if (!hasLocalStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
