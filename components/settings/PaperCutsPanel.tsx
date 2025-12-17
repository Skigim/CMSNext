import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Trash2, Copy, Scissors } from "lucide-react";
import { getPaperCuts, removePaperCut, clearPaperCuts, exportPaperCuts } from "@/utils/paperCutStorage";
import { clickToCopy } from "@/utils/clipboard";
import { toast } from "sonner";
import type { PaperCut } from "@/types/paperCut";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";

export function PaperCutsPanel() {
  const [paperCuts, setPaperCuts] = useState<PaperCut[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setPaperCuts(getPaperCuts());
  }, [refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleDelete = useCallback((id: string) => {
    removePaperCut(id);
    handleRefresh();
    toast.success("Paper cut removed");
  }, [handleRefresh]);

  const handleClearAll = useCallback(() => {
    clearPaperCuts();
    handleRefresh();
    toast.success("All paper cuts cleared");
  }, [handleRefresh]);

  const handleExport = useCallback(async () => {
    const text = exportPaperCuts();
    await clickToCopy(text, {
      successMessage: "Paper cuts exported to clipboard",
    });
  }, []);

  return (
    <div className="space-y-6" data-papercut-context="PaperCutsSettings">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Paper Cuts</h2>
          <p className="text-sm text-muted-foreground">
            Review and manage captured friction points and feedback.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={paperCuts.length === 0}>
            <Copy className="mr-2 h-4 w-4" />
            Export
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={paperCuts.length === 0}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all paper cuts?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all {paperCuts.length} captured items.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll}>Clear All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {paperCuts.length === 0 ? (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Scissors className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Paper Cuts Captured</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Use <Kbd><span className="text-xs">⌘</span>B</Kbd> or <Kbd><span className="text-xs">Ctrl</span>B</Kbd> anywhere in the app to report friction points.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {paperCuts.map((cut) => (
            <Card key={cut.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <time dateTime={cut.createdAt}>
                        {new Date(cut.createdAt).toLocaleString()}
                      </time>
                      <span>•</span>
                      <span className="font-mono">{cut.route}</span>
                      {cut.context && (
                        <>
                          <span>•</span>
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                            {cut.context}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive -mt-1 -mr-2"
                    onClick={() => handleDelete(cut.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{cut.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
