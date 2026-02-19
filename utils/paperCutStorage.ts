import type { PaperCut } from "@/types/paperCut";
import { createLocalStorageAdapter } from "@/utils/localStorage";

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

function safeParsePaperCuts(raw: string): PaperCut[] {
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

// Adapter with custom parse to validate paper cut array
const storage = createLocalStorageAdapter<PaperCut[]>("cmsnext-paper-cuts", [], {
  parse: safeParsePaperCuts,
});

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

  const existing = storage.read();
  storage.write([next, ...existing]);

  return next;
}

export function getPaperCuts(): PaperCut[] {
  return storage.read();
}

export function removePaperCut(id: string): void {
  const existing = storage.read();
  const next = existing.filter((pc) => pc.id !== id);
  storage.write(next);
}

export function clearPaperCuts(): void {
  storage.clear();
}

export function exportPaperCuts(): string {
  const paperCuts = storage.read();

  if (paperCuts.length === 0) {
    return "Paper Cuts Export\n\n(no items)";
  }

  const lines: string[] = [];
  lines.push(
    "Paper Cuts Export",
    `Exported: ${new Date().toISOString()}`,
    ""
  );

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
