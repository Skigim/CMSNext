import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Loader2, Upload, Trash2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import type { AVSImportState } from "../../hooks/useAVSImportFlow";
import type { ParsedAVSAccount } from "../../utils/avsParser";
import { formatCurrency } from "../../utils/financialFormatters";

interface AVSImportModalProps {
  /** Current import state */
  importState: AVSImportState;
  /** Called when input changes */
  onInputChange: (input: string) => void;
  /** Called to clear input */
  onClear: () => void;
  /** Called to import all accounts */
  onImport: () => Promise<void>;
  /** Called to close the modal */
  onClose: () => void;
  /** Whether import is possible */
  canImport: boolean;
}

/**
 * Preview card for a single parsed AVS account
 */
function AccountPreviewCard({ account, index }: { account: ParsedAVSAccount; index: number }) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
            {account.accountType !== "N/A" && (
              <Badge variant="secondary" className="text-xs">
                {account.accountType}
              </Badge>
            )}
          </div>
          <p className="font-medium text-sm mt-1 truncate">
            {account.bankName !== "N/A" ? account.bankName : "Unknown Institution"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold text-sm">
            {formatCurrency(account.balanceAmount)}
          </p>
          {account.accountNumber !== "N/A" && (
            <p className="text-xs text-muted-foreground">
              ****{account.accountNumber}
            </p>
          )}
        </div>
      </div>
      {account.accountOwner !== "N/A" && (
        <p className="text-xs text-muted-foreground truncate">
          Owner: {account.accountOwner}
        </p>
      )}
      <div className="flex items-center gap-2 pt-1 border-t">
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Verified
        </Badge>
        <Badge variant="outline" className="text-xs">
          AVS
        </Badge>
      </div>
    </div>
  );
}

/**
 * Summary of accounts to be imported
 */
function ImportSummary({ accounts }: { accounts: ParsedAVSAccount[] }) {
  const totalBalance = useMemo(
    () => accounts.reduce((sum, acc) => sum + acc.balanceAmount, 0),
    [accounts]
  );

  const accountTypes = useMemo(() => {
    const types = new Map<string, number>();
    accounts.forEach(acc => {
      const type = acc.accountType !== "N/A" ? acc.accountType : "Other";
      types.set(type, (types.get(type) || 0) + 1);
    });
    return Array.from(types.entries());
  }, [accounts]);

  return (
    <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Import Summary</span>
        <span className="text-sm text-muted-foreground">
          {accounts.length} account{accounts.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total Balance</span>
        <span className="font-semibold">{formatCurrency(totalBalance)}</span>
      </div>
      {accountTypes.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {accountTypes.map(([type, count]) => (
            <Badge key={type} variant="secondary" className="text-xs">
              {type}: {count}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Modal for importing AVS (Account Verification Service) data
 * 
 * Allows users to paste account block data and preview parsed accounts
 * before importing them as verified financial resources.
 */
export function AVSImportModal({
  importState,
  onInputChange,
  onClear,
  onImport,
  onClose,
  canImport,
}: AVSImportModalProps) {
  const { isOpen, rawInput, parsedAccounts, isImporting, importedCount, error } = importState;

  const hasInput = rawInput.trim().length > 0;
  const hasParsedAccounts = parsedAccounts.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import AVS Data
          </DialogTitle>
          <DialogDescription>
            Paste account data from AVS to automatically create verified financial resources.
            All imported items will be marked as &quot;Verified&quot; with source &quot;AVS&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
          {/* Input Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="avs-input" className="text-sm font-medium">
                Paste AVS Data
              </label>
              {hasInput && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                  className="h-7 text-xs"
                  disabled={isImporting}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <Textarea
              id="avs-input"
              value={rawInput}
              onChange={e => onInputChange(e.target.value)}
              placeholder={`Paste account blocks here. Example format:

John Doe; Jane Doe CHECKING
First National Bank - (123456789)
123 Main Street
Anytown, ST 12345
Balance as of 12/01/2025 - $5,432.10
Refresh Date: 12/01/2025`}
              className="min-h-[120px] font-mono text-xs resize-y"
              disabled={isImporting}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Preview Section */}
          {hasInput && (
            <div className="flex-1 overflow-hidden flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {hasParsedAccounts
                    ? `Preview (${parsedAccounts.length} account${parsedAccounts.length !== 1 ? "s" : ""} found)`
                    : "No accounts found"}
                </span>
              </div>

              {hasParsedAccounts ? (
                <>
                  <ImportSummary accounts={parsedAccounts} />
                  <div className="flex-1 overflow-y-auto space-y-2 min-h-0 max-h-[200px]">
                    {parsedAccounts.map((account, index) => (
                      <AccountPreviewCard
                        key={`${account.bankName}-${account.accountNumber}-${index}`}
                        account={account}
                        index={index}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Could not parse any accounts from the input.
                  </p>
                  <p className="text-xs mt-1">
                    Check that the data is in the expected AVS format.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Success message after import */}
          {importedCount > 0 && !isImporting && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-700">
                Successfully imported {importedCount} resource{importedCount !== 1 ? "s" : ""}.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={onImport}
            disabled={!canImport}
            className="min-w-[120px]"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {hasParsedAccounts ? parsedAccounts.length : ""} Resource
                {parsedAccounts.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
