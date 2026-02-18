import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Kbd } from "@/components/ui/kbd";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getShortcutConfig,
  updateShortcutBinding,
  toggleShortcut,
  resetAllShortcuts,
} from "@/utils/shortcutStorage";
import {
  resolveShortcuts,
  formatBindingForDisplay,
} from "@/utils/keyboardShortcuts";
import { ResolvedShortcut } from "@/types/keyboardShortcuts";
import { RotateCcw, Pencil } from "lucide-react";
import { toast } from "sonner";

interface ShortcutEditorProps {
  shortcut: ResolvedShortcut;
  isMac: boolean;
  allShortcuts: ResolvedShortcut[];
  onSave: (binding: string) => void;
  onCancel: () => void;
}

function tokenizeBindingForDisplay(display: string): Array<{ key: string; value: string }> {
  const counts = new Map<string, number>();

  return display.split(" ").map((part) => {
    const nextCount = (counts.get(part) ?? 0) + 1;
    counts.set(part, nextCount);
    return { key: `${part}-${nextCount}`, value: part };
  });
}

function ShortcutEditor({
  shortcut,
  isMac,
  allShortcuts,
  onSave,
  onCancel,
}: Readonly<ShortcutEditorProps>) {
  const [currentBinding, setCurrentBinding] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Cancel on Escape
      if (e.key === "Escape") {
        onCancel();
        return;
      }

      const modifiers = [];
      if (e.ctrlKey) modifiers.push("ctrl");
      if (e.metaKey) modifiers.push("meta");
      if (e.altKey) modifiers.push("alt");
      if (e.shiftKey) modifiers.push("shift");

      const key = e.key.toLowerCase();
      
      // Ignore modifier-only presses
      if (["control", "meta", "alt", "shift"].includes(key)) return;

      const binding = [...modifiers, key].join("+");
      setCurrentBinding(binding);

      // Check for conflicts
      const conflictFound = allShortcuts.find(s => s.binding === binding && s.id !== shortcut.id && s.enabled);
      if (conflictFound) {
        setConflict(conflictFound.label);
      } else {
        setConflict(null);
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [allShortcuts, shortcut.id, onCancel]);

  const handleSave = () => {
    if (currentBinding) {
      onSave(currentBinding);
    }
  };

  return (
    <div className="space-y-4 w-[280px]">
      <div className="space-y-2">
        <h4 className="font-medium leading-none">Edit Shortcut</h4>
        <p className="text-sm text-muted-foreground">
          Press the key combination you want to use for <span className="font-medium text-foreground">{shortcut.label}</span>.
        </p>
      </div>
      
      <div className="flex items-center justify-center h-20 border rounded-md bg-muted/50">
        {currentBinding ? (
          <div className="flex gap-1">
            {tokenizeBindingForDisplay(formatBindingForDisplay(currentBinding, isMac)).map((token) => (
              <Kbd key={token.key} className="bg-background">{token.value}</Kbd>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground animate-pulse">Press keys...</span>
        )}
      </div>

      {conflict && (
        <div className="text-xs text-destructive font-medium">
          Conflict with: {conflict}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          size="sm" 
          onClick={handleSave} 
          disabled={!currentBinding || !!conflict}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export function KeyboardShortcutsPanel() {
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [shortcuts, setShortcuts] = useState<ResolvedShortcut[]>(() => {
    const config = getShortcutConfig();
    return resolveShortcuts(config);
  });

  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  }, []);

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

  const reloadShortcuts = useCallback(() => {
    const config = getShortcutConfig();
    setShortcuts(resolveShortcuts(config));
  }, []);

  const handleToggle = (id: string, enabled: boolean) => {
    toggleShortcut(id, enabled);
    reloadShortcuts();
  };

  const handleReset = (id: string) => {
    updateShortcutBinding(id, null);
    reloadShortcuts();
    toast.success("Shortcut reset to default");
  };

  const handleResetAll = () => {
    resetAllShortcuts();
    reloadShortcuts();
    toast.success("All shortcuts reset to defaults");
  };

  const handleSaveBinding = (id: string, binding: string) => {
    updateShortcutBinding(id, binding);
    setOpenPopoverId(null);
    reloadShortcuts();
    toast.success("Shortcut updated");
  };

  return (
    <div className="space-y-6" data-papercut-context="KeyboardShortcutsSettings">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Keyboard Shortcuts</h2>
          <p className="text-sm text-muted-foreground">
            Customize keyboard shortcuts for your workflow.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset All
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all shortcuts?</AlertDialogTitle>
              <AlertDialogDescription>
                This will revert all keyboard shortcuts to their default bindings. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetAll}>Reset All</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {categories.map((cat) => {
        const group = groupedShortcuts[cat];
        if (!group || group.length === 0) return null;

        return (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">
                {categoryLabels[cat] ?? cat}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1">
              {group.map((shortcut) => {
                const isDefault = shortcut.binding === shortcut.defaultBinding;
                const display = formatBindingForDisplay(shortcut.binding, isMac);
                const isOpen = openPopoverId === shortcut.id;

                return (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Switch
                        checked={shortcut.enabled}
                        onCheckedChange={(checked) => handleToggle(shortcut.id, checked)}
                        aria-label={`Enable ${shortcut.label}`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          shortcut.enabled ? "" : "opacity-50 line-through"
                        }`}
                      >
                        {shortcut.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Popover open={isOpen} onOpenChange={(open) => setOpenPopoverId(open ? shortcut.id : null)}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 min-w-[100px] font-normal justify-start px-2 gap-2"
                            disabled={!shortcut.enabled}
                          >
                            {tokenizeBindingForDisplay(display).map((token) => (
                              <Kbd key={token.key} className="bg-muted-foreground/10">{token.value}</Kbd>
                            ))}
                            <Pencil className="ml-auto h-3 w-3 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4" align="end">
                          <ShortcutEditor 
                            shortcut={shortcut}
                            isMac={isMac}
                            allShortcuts={shortcuts}
                            onSave={(binding) => handleSaveBinding(shortcut.id, binding)}
                            onCancel={() => setOpenPopoverId(null)}
                          />
                        </PopoverContent>
                      </Popover>

                      {!isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleReset(shortcut.id)}
                          title="Reset to default"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
