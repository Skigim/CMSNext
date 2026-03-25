import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, AlertTriangle, ArrowRight, Trash2 } from "lucide-react";
import type { MarkdownCaseImportState } from "@/hooks/useMarkdownCaseImportFlow";

interface MarkdownCaseImportModalProps {
  importState: MarkdownCaseImportState;
  onInputChange: (input: string) => void;
  onClear: () => void;
  onClose: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
}

function groupMappedFields(mappedFields: NonNullable<MarkdownCaseImportState["review"]>["mappedFields"]) {
  return mappedFields.reduce<Record<string, typeof mappedFields>>((groups, field) => {
    groups[field.section] = [...(groups[field.section] ?? []), field];
    return groups;
  }, {});
}

export function MarkdownCaseImportModal({
  importState,
  onInputChange,
  onClear,
  onClose,
  onConfirm,
  canConfirm,
}: Readonly<MarkdownCaseImportModalProps>) {
  const { isOpen, rawInput, review } = importState;
  const groupedMappedFields = useMemo(
    () => (review ? groupMappedFields(review.mappedFields) : {}),
    [review],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Case from Markdown
          </DialogTitle>
          <DialogDescription>
            Paste the approved markdown format, review the mapped intake draft, then continue into the existing intake flow.
            The original markdown is used only for this review and will not be saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="markdown-case-import-input" className="text-sm font-medium">
                Paste markdown
              </label>
              {rawInput.trim().length > 0 ? (
                <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              ) : null}
            </div>
            <Textarea
              id="markdown-case-import-input"
              value={rawInput}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="## Person Info\n| Field | Value |\n| --- | --- |\n| First Name | Jane |"
              className="min-h-40 font-mono text-xs"
            />
          </div>

          {review ? (
            <div className="overflow-hidden flex flex-col max-h-[32rem] border rounded-lg">
              <ScrollArea className="h-full max-h-80">
                <div className="space-y-4 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{review.mappedFields.length} mapped</Badge>
                    <Badge variant="outline">{review.householdPreview.length} household</Badge>
                    {review.unsupportedFields.length > 0 ? (
                      <Badge variant="outline">{review.unsupportedFields.length} ignored fields</Badge>
                    ) : null}
                    {review.unsupportedSections.length > 0 ? (
                      <Badge variant="outline">{review.unsupportedSections.length} ignored sections</Badge>
                    ) : null}
                  </div>

                  {review.warnings.length > 0 ? (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Review warnings</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc pl-5 space-y-1">
                          {review.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {Object.entries(groupedMappedFields).map(([section, fields]) => (
                    <section key={section} className="space-y-2">
                      <h3 className="text-sm font-semibold">{section}</h3>
                      <div className="space-y-2 rounded-md border p-3">
                        {fields.map((field) => (
                          <div key={`${field.section}-${field.label}-${field.target}`} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-medium">{field.label}</p>
                              <p className="text-xs text-muted-foreground break-all">{field.value}</p>
                            </div>
                            <Badge variant="outline">{field.target}</Badge>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}

                  {review.unsupportedFields.length > 0 ? (
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold">Ignored fields</h3>
                      <div className="rounded-md border p-3 space-y-2">
                        {review.unsupportedFields.map((field) => (
                          <div key={`${field.section}-${field.label}-${field.value}`} className="space-y-1">
                            <p className="text-sm font-medium">{field.section}: {field.label}</p>
                            <p className="text-xs text-muted-foreground break-all">{field.value}</p>
                            <p className="text-xs text-muted-foreground">{field.reason}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {review.unsupportedSections.length > 0 ? (
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold">Ignored sections</h3>
                      <div className="flex flex-wrap gap-2">
                        {review.unsupportedSections.map((section) => (
                          <Badge key={section} variant="outline">{section}</Badge>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground sm:mr-auto">
            Continue into intake to validate, edit, and save. Nothing is persisted from this modal.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={onConfirm} disabled={!canConfirm} className="gap-2">
              Continue to Intake
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
