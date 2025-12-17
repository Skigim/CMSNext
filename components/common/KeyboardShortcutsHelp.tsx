import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { getShortcutConfig } from "@/utils/shortcutStorage";
import { resolveShortcuts, formatBindingForDisplay } from "@/utils/keyboardShortcuts";
import type { ResolvedShortcut } from "@/types/keyboardShortcuts";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomize?: () => void;
}

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
  onCustomize,
}: KeyboardShortcutsHelpProps) {
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform ?? navigator.userAgent ?? "");
  }, []);

  const [shortcuts, setShortcuts] = useState<ResolvedShortcut[]>([]);

  useEffect(() => {
    if (open) {
      const config = getShortcutConfig();
      setShortcuts(resolveShortcuts(config));
    }
  }, [open]);

  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, typeof shortcuts> = {};
    for (const s of shortcuts) {
      if (!groups[s.category]) {
        groups[s.category] = [];
      }
      groups[s.category].push(s);
    }
    return groups;
  }, [shortcuts]);

  const categories = ["navigation", "actions", "ui"];
  const categoryLabels: Record<string, string> = {
    navigation: "Navigation",
    actions: "Actions",
    ui: "Interface",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Speed up your workflow with these keyboard shortcuts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {categories.map((cat) => {
            const group = groupedShortcuts[cat];
            if (!group || group.length === 0) return null;

            return (
              <div key={cat} className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {categoryLabels[cat] ?? cat}
                </h3>
                <div className="grid gap-2">
                  {group.map((shortcut) => {
                    const display = formatBindingForDisplay(shortcut.binding, isMac);
                    // Split chord bindings (e.g. "⌘G D") for better display if needed
                    // For now, we'll just display the formatted string
                    
                    return (
                      <div
                        key={shortcut.id}
                        className={`flex items-center justify-between text-sm ${
                          !shortcut.enabled ? "opacity-50" : ""
                        }`}
                      >
                        <span className={!shortcut.enabled ? "line-through" : ""}>
                          {shortcut.label}
                        </span>
                        <div className="flex items-center gap-1">
                          {display.split(" ").map((part, i) => (
                            <Kbd key={i}>{part}</Kbd>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Separator className="mt-4" />
              </div>
            );
          })}
        </div>

        {onCustomize && (
          <div className="flex justify-end pt-2">
            <Button
              variant="link"
              className="text-xs text-muted-foreground h-auto p-0"
              onClick={() => {
                onOpenChange(false);
                onCustomize();
              }}
            >
              Customize in Settings →
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
