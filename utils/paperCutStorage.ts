import type { PaperCut } from "@/types/paperCut";

/**
 * Paper Cut Storage Utilities
 * ===========================
 * Manages persistent storage of paper cut screen captures.
 * Stores screenshots locally for quick reference and UX feedback.
 * 
 * ## Features
 * 
 * - **Local Storage**: Persist paper cuts across sessions
 * - **Retrieval**: Get saved paper cuts by ID or list all
 * - **Cleanup**: Remove individual or all paper cuts
 * - **Type Safety**: Fully typed paper cut objects
 * 
 * @module paperCutStorage
 */

const STORAGE_KEY = "papercuts";

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function safeParsePaperCuts(raw: string | null): PaperCut[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    // Best-effort validation to prevent runtime errors if storage is corrupted.
    return parsed.filter((item): item is PaperCut => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Record<string, unknown>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.content === "string" &&
        typeof candidate.route === "string" &&
        typeof candidate.context === "string" &&
        typeof candidate.createdAt === "string"
      );
    });
  } catch {
    return [];
  }
}

function readPaperCuts(): PaperCut[] {
  if (!hasLocalStorage()) return [];
  return safeParsePaperCuts(window.localStorage.getItem(STORAGE_KEY));
}

function writePaperCuts(paperCuts: PaperCut[]): void {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(paperCuts));
}

function generateId(): string {
  try {
    const cryptoObj = typeof crypto !== "undefined" ? crypto : undefined;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  } catch {
    // ignore
  }

  return `papercut_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function addPaperCut(content: string, route: string, context: string): PaperCut {
  const nowIso = new Date().toISOString();

  const next: PaperCut = {
    id: generateId(),
    content,
    route,
    context,
    createdAt: nowIso,
  };

  const existing = readPaperCuts();
  writePaperCuts([next, ...existing]);

  return next;
}

export function getPaperCuts(): PaperCut[] {
  return readPaperCuts();
}

export function removePaperCut(id: string): void {
  const existing = readPaperCuts();
  const next = existing.filter((pc) => pc.id !== id);
  writePaperCuts(next);
}

export function clearPaperCuts(): void {
  if (!hasLocalStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function exportPaperCuts(): string {
  const paperCuts = readPaperCuts();

  if (paperCuts.length === 0) {
    return "Paper Cuts Export\n\n(no items)";
  }

  const lines: string[] = [];
  lines.push("Paper Cuts Export");
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push("");

  for (const pc of paperCuts) {
    lines.push(`- ${pc.createdAt} | ${pc.route}`);
    lines.push(pc.content.trim().length > 0 ? `  ${pc.content.trim()}` : "  (no content)");
    if (pc.context.trim().length > 0) {
      lines.push(`  Context: ${pc.context.trim()}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
