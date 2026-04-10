import { useId, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface WorkspaceUpgradeNoticeModalProps {
  isOpen: boolean;
  noticeKind: "migrated" | "current";
  onAcknowledge: () => void;
}

const modalCopy = {
  migrated: {
    title: "Workspace upgraded to v2.2",
    description:
      "CMSNext upgraded this workspace while connecting so it now uses the canonical v2.2 file format.",
    icon: AlertTriangle,
    accentClassName: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    summary:
      "The migration bridge has been removed. This workspace and any supported archive files were updated to the current format during load.",
  },
  current: {
    title: "Workspace is already on v2.2",
    description:
      "This workspace already uses the canonical v2.2 file format that CMSNext now loads directly.",
    icon: CheckCircle2,
    accentClassName: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
    summary:
      "The older migration bridge is no longer part of the load path. This workspace is already in the required current format.",
  },
} as const;

export function WorkspaceUpgradeNoticeModal({
  isOpen,
  noticeKind,
  onAcknowledge,
}: WorkspaceUpgradeNoticeModalProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const checkboxId = useId();
  const copy = modalCopy[noticeKind];
  const Icon = copy.icon;

  const handleAcknowledge = () => {
    setIsConfirmed(false);
    onAcknowledge();
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent
        hideCloseButton
        className="max-w-3xl border-2 px-0 py-0 sm:px-0 sm:py-0"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="space-y-6 p-6 sm:p-8">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-start gap-4">
              <div className={`rounded-2xl border p-3 ${copy.accentClassName}`}>
                <Icon className="size-6" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <DialogTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {copy.title}
                </DialogTitle>
                <DialogDescription className="max-w-2xl text-sm leading-6 sm:text-base">
                  {copy.description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="rounded-2xl border bg-muted/40 p-5">
            <p className="text-sm font-medium text-foreground sm:text-base">What changed</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
              {copy.summary}
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-dashed p-5">
            <p className="text-sm font-medium text-foreground sm:text-base">Required confirmation</p>
            <div className="flex items-start gap-3 rounded-xl bg-background/80 p-4">
              <Checkbox
                id={checkboxId}
                checked={isConfirmed}
                onCheckedChange={(checked) => setIsConfirmed(checked === true)}
                className="mt-1"
              />
              <Label htmlFor={checkboxId} className="cursor-pointer items-start text-sm leading-6 font-normal">
                I understand that this workspace now uses the canonical v2.2 format and that the old migration compatibility bridge is no longer part of the normal load path.
              </Label>
            </div>
          </div>

          <DialogFooter className="border-t pt-6 sm:justify-between">
            <p className="text-xs leading-5 text-muted-foreground sm:max-w-xl sm:text-sm">
              This notice requires confirmation so the workspace format change cannot be missed.
            </p>
            <Button type="button" size="lg" onClick={handleAcknowledge} disabled={!isConfirmed}>
              Continue to workspace
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}