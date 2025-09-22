import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { FinancialItem, CaseCategory } from "../types/case";
import { Edit2, Trash2, Check, X, Plus, StickyNote } from "lucide-react";

interface FinancialItemCardProps {
  item: FinancialItem;
  itemType: CaseCategory;
  onEdit: (category: CaseCategory, itemId: string) => void;
  onDelete: (category: CaseCategory, itemId: string) => void;
  showActions?: boolean;
}

export function FinancialItemCard({
  item,
  itemType,
  onEdit,
  onDelete,
  showActions = true,
}: FinancialItemCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Get verification status styling and text
  const getVerificationStatus = () => {
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
  const getDisplayAmount = () => {
    const amount = item.amount || 0;
    const baseAmount = formatCurrency(amount);

    // Only show frequency for income and expense items, not resources
    if (item.frequency && itemType !== 'resources') {
      return baseAmount + formatFrequency(item.frequency);
    }

    return baseAmount;
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmingDelete) {
      setConfirmingDelete(false);
    } else {
      setConfirmingDelete(true);
    }
  };

  const handleDeleteConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.id) {
      onDelete(itemType, item.id);
    }
    setConfirmingDelete(false);
  };

  const handleEdit = () => {
    if (item.id) {
      onEdit(itemType, item.id);
    }
  };

  const verificationStatus = getVerificationStatus();

  return (
    <div
      className={`
        bg-card border border-border p-3 rounded-lg cursor-pointer group
        hover:shadow-lg hover:-translate-y-0.5 transform transition-all duration-200
        hover:border-primary/20 hover:bg-accent/30
        ${confirmingDelete ? 'ring-2 ring-destructive/50 bg-destructive/5' : ''}
      `}
      onClick={handleEdit}
    >
      <div className="space-y-2">
        {/* Top row: Description and Amount */}
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h6 className="text-sm font-medium text-foreground truncate">
              {item.description || item.name || 'Untitled Item'}
            </h6>
          </div>
          <div className="text-foreground font-medium text-sm ml-3 shrink-0">
            {getDisplayAmount()}
          </div>
        </div>

        {/* Second row: Institution (if available) */}
        {item.location && (
          <div className="text-xs text-muted-foreground">
            {item.location}
          </div>
        )}

        {/* Third row: Account Number with Badge and Note Indicator */}
        <div className="flex justify-between items-center">
          {/* Left side: Account Number and Note Indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{item.accountNumber ? formatAccountNumber(item.accountNumber) : ''}</span>
            {item.notes && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <StickyNote className="h-3 w-3 text-muted-foreground/70 hover:text-muted-foreground transition-colors" />
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
          
          {/* Badge - right side */}
          <Badge variant={verificationStatus.variant} className="text-xs">
            {verificationStatus.text}
          </Badge>
        </div>

        {/* Action buttons (only shown when confirming delete) */}
        {showActions && confirmingDelete && (
          <div className="flex justify-end space-x-2 pt-1 border-t border-border">
            {/* Confirm button (green check) */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteConfirm}
              className="h-8 w-8 p-0 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
            >
              <Check className="h-4 w-4" />
            </Button>
            {/* Cancel button (red X) */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteClick}
              className="h-8 w-8 p-0 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Regular action buttons (when not confirming delete) - visible on hover */}
        {showActions && !confirmingDelete && (
          <div className="flex justify-end space-x-1 pt-1 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit();
              }}
              className="h-8 w-8 p-0 hover:bg-accent"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface FinancialItemListProps {
  items: FinancialItem[];
  itemType: CaseCategory;
  onEdit: (category: CaseCategory, itemId: string) => void;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onAdd: (category: CaseCategory) => void;
  title: string;
  showActions?: boolean;
}

export function FinancialItemList({
  items = [],
  itemType,
  onEdit,
  onDelete,
  onAdd,
  title,
  showActions = true,
}: FinancialItemListProps) {
  return (
    <div className={title ? "space-y-4" : ""}>
      {/* Header - only show if title is provided */}
      {title && (
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-medium text-foreground">{title}</h4>
          <Button
            size="sm"
            onClick={() => onAdd(itemType)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">
            No {itemType} items added yet
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAdd(itemType)}
            className="mt-3"
          >
            Add First Item
          </Button>
        </div>
      ) : (
        <div className="space-y-2 group">
          {items.map((item, index) => (
            <FinancialItemCard
              key={item.id || `${itemType}-${index}`}
              item={item}
              itemType={itemType}
              onEdit={onEdit}
              onDelete={onDelete}
              showActions={showActions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FinancialItemGridProps {
  items: FinancialItem[];
  itemType: CaseCategory;
  onEdit: (category: CaseCategory, itemId: string) => void;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onAdd: (category: CaseCategory) => void;
  title: string;
  showActions?: boolean;
  columns?: 'auto' | 1 | 2 | 3 | 4;
}

export function FinancialItemGrid({
  items = [],
  itemType,
  onEdit,
  onDelete,
  onAdd,
  title,
  showActions = true,
  columns = 'auto',
}: FinancialItemGridProps) {
  // Determine grid columns class
  const getGridClass = () => {
    if (columns === 'auto') return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    return `grid-cols-${columns}`;
  };

  return (
    <div className="space-y-4">
      {/* Header with add button */}
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-medium text-foreground">{title}</h4>
        <Button
          size="sm"
          onClick={() => onAdd(itemType)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Items grid */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">
            No {itemType} items added yet
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAdd(itemType)}
            className="mt-3"
          >
            Add First Item
          </Button>
        </div>
      ) : (
        <div className={`grid ${getGridClass()} gap-3 group`}>
          {items.map((item, index) => (
            <FinancialItemCard
              key={item.id || `${itemType}-${index}`}
              item={item}
              itemType={itemType}
              onEdit={onEdit}
              onDelete={onDelete}
              showActions={showActions}
            />
          ))}
        </div>
      )}
    </div>
  );
}