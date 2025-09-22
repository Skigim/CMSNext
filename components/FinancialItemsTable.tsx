import { useState, useCallback } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { FinancialItem, CaseCategory } from "../types/case";
import { Edit2, Trash2, Check, X, Plus, StickyNote, ArrowUpDown } from "lucide-react";

interface FinancialItemsTableProps {
  items: FinancialItem[];
  itemType: CaseCategory;
  onEdit: (category: CaseCategory, itemId: string) => void;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onAdd: (category: CaseCategory) => void;
  title: string;
  showActions?: boolean;
}

interface EditingState {
  itemId: string | null;
  field: string | null;
  value: string;
}

type SortField = 'description' | 'amount' | 'location' | 'verificationStatus';
type SortDirection = 'asc' | 'desc';

export function FinancialItemsTable({
  items = [],
  itemType,
  onEdit,
  onDelete,
  onAdd,
  title,
  showActions = true,
}: FinancialItemsTableProps) {
  const [editing, setEditing] = useState<EditingState>({ itemId: null, field: null, value: '' });
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('description');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Get verification status styling and text
  const getVerificationStatus = (item: FinancialItem) => {
    const status = (item.verificationStatus || 'Needs VR').toLowerCase();
    const statusMap: Record<string, { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'verified': { text: 'Verified', variant: 'default' },
      'needs vr': { text: 'Needs VR', variant: 'secondary' },
      'vr pending': { text: 'VR Pending', variant: 'outline' },
      'avs pending': { text: 'AVS Pending', variant: 'outline' },
    };

    let badgeInfo = statusMap[status] || statusMap['needs vr'];

    // Append verification source for verified items
    if (status === 'verified' && item.verificationSource) {
      badgeInfo = { 
        ...badgeInfo, 
        text: `${badgeInfo.text} (${item.verificationSource})` 
      };
    }

    return badgeInfo;
  };

  // Format currency amounts
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  // Format frequency display for income/expense items
  const formatFrequency = (frequency?: string) => {
    const frequencyMap: Record<string, string> = {
      monthly: '/mo',
      yearly: '/yr',
      weekly: '/wk',
      daily: '/day',
      'one-time': ' (1x)',
    };
    return frequency ? frequencyMap[frequency] || '' : '';
  };

  // Format account number to show only last 4 digits
  const formatAccountNumber = (accountNumber?: string) => {
    if (!accountNumber) return '';
    const digits = accountNumber.replace(/\D/g, ''); // Remove non-digits
    if (digits.length <= 4) return digits;
    return `****${digits.slice(-4)}`;
  };

  // Get display amount with frequency (but not for resources)
  const getDisplayAmount = (item: FinancialItem) => {
    const amount = item.amount || 0;
    const baseAmount = formatCurrency(amount);

    // Only show frequency for income and expense items, not resources
    if (item.frequency && itemType !== 'resources') {
      return baseAmount + formatFrequency(item.frequency);
    }

    return baseAmount;
  };

  // Sorting logic
  const sortedItems = [...items].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortField) {
      case 'description':
        aValue = (a.description || a.name || '').toLowerCase();
        bValue = (b.description || b.name || '').toLowerCase();
        break;
      case 'amount':
        aValue = a.amount || 0;
        bValue = b.amount || 0;
        break;
      case 'location':
        aValue = (a.location || '').toLowerCase();
        bValue = (b.location || '').toLowerCase();
        break;
      case 'verificationStatus':
        aValue = (a.verificationStatus || 'Needs VR').toLowerCase();
        bValue = (b.verificationStatus || 'Needs VR').toLowerCase();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle inline editing
  const startEditing = (itemId: string, field: string, currentValue: string) => {
    setEditing({ itemId, field, value: currentValue });
  };

  const cancelEditing = () => {
    setEditing({ itemId: null, field: null, value: '' });
  };

  const saveEdit = useCallback(() => {
    if (editing.itemId) {
      // For now, trigger the modal edit - we'll implement inline saving later
      onEdit(itemType, editing.itemId);
      cancelEditing();
    }
  }, [editing.itemId, onEdit, itemType]);

  // Handle delete confirmation
  const handleDeleteClick = (itemId: string) => {
    setConfirmingDelete(itemId);
  };

  const handleDeleteConfirm = (itemId: string) => {
    onDelete(itemType, itemId);
    setConfirmingDelete(null);
  };

  const handleDeleteCancel = () => {
    setConfirmingDelete(null);
  };

  // Render editable cell
  const renderEditableCell = (item: FinancialItem, field: string, value: string, isEditing: boolean) => {
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input
            value={editing.value}
            onChange={(e) => setEditing(prev => ({ ...prev, value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEditing();
            }}
            onBlur={saveEdit}
            autoFocus
            className="h-8 text-sm"
          />
        </div>
      );
    }

    return (
      <div
        className="cursor-pointer hover:bg-accent/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
        onClick={() => startEditing(item.id, field, value)}
      >
        {value || <span className="text-muted-foreground">Click to edit</span>}
      </div>
    );
  };

  // Render verification status cell
  const renderVerificationCell = (item: FinancialItem) => {
    const status = getVerificationStatus(item);
    const isEditing = editing.itemId === item.id && editing.field === 'verificationStatus';

    if (isEditing) {
      return (
        <Select
          value={editing.value}
          onValueChange={(value) => setEditing(prev => ({ ...prev, value }))}
          onOpenChange={(open) => !open && saveEdit()}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Needs VR">Needs VR</SelectItem>
            <SelectItem value="VR Pending">VR Pending</SelectItem>
            <SelectItem value="AVS Pending">AVS Pending</SelectItem>
            <SelectItem value="Verified">Verified</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    return (
      <Badge 
        variant={status.variant} 
        className="cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => startEditing(item.id, 'verificationStatus', item.verificationStatus || 'Needs VR')}
      >
        {status.text}
      </Badge>
    );
  };

  if (items.length === 0) {
    return (
      <div className={title ? "space-y-4" : ""}>
        {/* Header - only show if title is provided */}
        {title && (
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-medium text-foreground">{title}</h4>
            <Button size="sm" onClick={() => onAdd(itemType)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        )}

        {/* Empty state */}
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground text-sm mb-3">
            No {itemType} items added yet
          </p>
          <Button variant="outline" size="sm" onClick={() => onAdd(itemType)}>
            Add First Item
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={title ? "space-y-4" : ""}>
      {/* Header - only show if title is provided */}
      {title && (
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-medium text-foreground">{title}</h4>
          <Button size="sm" onClick={() => onAdd(itemType)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">
                <Button 
                  variant="ghost" 
                  className="h-auto p-0 font-medium hover:bg-transparent"
                  onClick={() => handleSort('description')}
                >
                  Description
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[20%]">
                <Button 
                  variant="ghost" 
                  className="h-auto p-0 font-medium hover:bg-transparent"
                  onClick={() => handleSort('amount')}
                >
                  Amount
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[20%]">
                <Button 
                  variant="ghost" 
                  className="h-auto p-0 font-medium hover:bg-transparent"
                  onClick={() => handleSort('location')}
                >
                  Institution
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[15%]">Account</TableHead>
              <TableHead className="w-[15%]">
                <Button 
                  variant="ghost" 
                  className="h-auto p-0 font-medium hover:bg-transparent"
                  onClick={() => handleSort('verificationStatus')}
                >
                  Status
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              {showActions && <TableHead className="w-[60px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item, index) => (
              <TableRow 
                key={item.id || `${itemType}-${index}`}
                className={confirmingDelete === item.id ? 'bg-destructive/5' : ''}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    {renderEditableCell(
                      item, 
                      'description', 
                      item.description || item.name || '', 
                      editing.itemId === item.id && editing.field === 'description'
                    )}
                    {item.notes && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <StickyNote className="h-3 w-3 text-muted-foreground/70 hover:text-muted-foreground transition-colors shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs max-w-xs">
                              {item.notes.length > 100 ? `${item.notes.substring(0, 100)}...` : item.notes}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {renderEditableCell(
                    item, 
                    'amount', 
                    getDisplayAmount(item), 
                    editing.itemId === item.id && editing.field === 'amount'
                  )}
                </TableCell>
                <TableCell>
                  {renderEditableCell(
                    item, 
                    'location', 
                    item.location || '', 
                    editing.itemId === item.id && editing.field === 'location'
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatAccountNumber(item.accountNumber)}
                </TableCell>
                <TableCell>
                  {renderVerificationCell(item)}
                </TableCell>
                {showActions && (
                  <TableCell>
                    {confirmingDelete === item.id ? (
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteConfirm(item.id)}
                          className="h-6 w-6 p-0 border-green-500 text-green-600 hover:bg-green-50"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDeleteCancel}
                          className="h-6 w-6 p-0 border-red-500 text-red-600 hover:bg-red-50"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(itemType, item.id)}
                          className="h-6 w-6 p-0 hover:bg-accent"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(item.id)}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}