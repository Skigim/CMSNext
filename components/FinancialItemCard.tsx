import { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { FinancialItem, CaseCategory } from "../types/case";
import { Trash2, Check, X, Plus, StickyNote, Landmark, Wallet, Receipt, ChevronDown } from "lucide-react";
import { formatAccountNumber, getDisplayAmount, parseNumericInput } from "../utils/financialFormatters";
import { getVerificationStatusInfo, shouldShowVerificationSource, updateVerificationStatus } from "../utils/verificationStatus";
import { getNormalizedItem, getNormalizedFormData } from "../utils/dataNormalization";
import "../styles/financial-item-animations.css";

interface FinancialItemCardProps {
  item: FinancialItem;
  itemType: CaseCategory;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onUpdate?: (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => void;
  showActions?: boolean;
  isSkeleton?: boolean;
  isEditing?: boolean;
}

export function FinancialItemCard({
  item,
  itemType,
  onDelete,
  onUpdate,
  showActions = true,
  isSkeleton = false,
  isEditing: initialIsEditing = false,
}: FinancialItemCardProps) {
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [formData, setFormData] = useState(item);

  // Normalized data accessors using extracted utilities
  const normalizedItem = getNormalizedItem(item);
  const normalizedFormData = getNormalizedFormData(formData);

  // Get category icon
  const getCategoryIcon = () => {
    switch (itemType) {
      case 'resources':
        return <Landmark className="w-5 h-5" />;
      case 'income':
        return <Wallet className="w-5 h-5" />;
      case 'expenses':
        return <Receipt className="w-5 h-5" />;
    }
  };

  const handleCardClick = () => {
    if (isEditing) return; // Don't toggle if already editing
    
    if (onUpdate) {
      // Use inline editing if onUpdate is provided
      setFormData(item);
      setIsEditing(true);
    }
  };

  const handleCancelClick = () => {
    if (isSkeleton && onDelete && normalizedItem.safeId) {
      onDelete(itemType, normalizedItem.safeId); // For skeleton cards, remove from list
    } else {
      setIsEditing(false);
      setFormData(item); // Reset form data
    }
  };

  const handleSaveClick = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (onUpdate && normalizedItem.safeId) {
      try {
        await onUpdate(itemType, normalizedItem.safeId, formData);
        setIsEditing(false);
      } catch (error) {
        console.error('[FinancialItemCard] Failed to update item:', error);
      }
    }
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Get verification status styling and text with consistent colors
  const getVerificationStatus = () => {
    const badgeInfo = getVerificationStatusInfo(
      normalizedItem.verificationStatus, 
      normalizedItem.verificationSource
    );
    return badgeInfo;
  };

  // Get display amount with frequency (but not for resources) - using extracted utility
  const getDisplayAmountLocal = () => {
    return getDisplayAmount(normalizedItem.amount, normalizedItem.frequency, itemType);
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
    if (normalizedItem.safeId) {
      onDelete(itemType, normalizedItem.safeId);
    }
    setConfirmingDelete(false);
  };

  const handleStatusChange = async (newStatus: 'Needs VR' | 'VR Pending' | 'AVS Pending' | 'Verified') => {
    if (!onUpdate || !normalizedItem.safeId) return;
    
    try {
      // Update the verification status using extracted utility
      const updatedItem = updateVerificationStatus(item, newStatus);
      await onUpdate(itemType, normalizedItem.safeId, updatedItem);
    } catch (error) {
      console.error('Failed to update verification status:', error);
    }
  };

  const verificationStatus = getVerificationStatus();

  return (
    <div className={`financial-item-card ${isSkeleton ? 'financial-item-card--skeleton' : ''}`}>
      {/* Display Header (Always Visible) - Now clickable */}
      <div 
        className="p-4 cursor-pointer" 
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 text-primary p-2 rounded-lg">
              {getCategoryIcon()}
            </div>
            <div>
              <p className="font-semibold text-foreground">{normalizedItem.displayName}</p>
              <p className="text-sm text-muted-foreground">
                {normalizedItem.dateAdded ? new Date(normalizedItem.dateAdded).toLocaleDateString() : 'No date'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-lg font-mono text-foreground">{getDisplayAmountLocal()}</p>
          </div>
        </div>

        {/* Additional info row */}
        <div className="flex justify-between items-center mt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {normalizedItem.location && <span>{normalizedItem.location}</span>}
            {normalizedItem.accountNumber && <span>{formatAccountNumber(normalizedItem.accountNumber)}</span>}
            {normalizedItem.notes && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <StickyNote className="h-3 w-3 text-muted-foreground/70 hover:text-muted-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">
                      {normalizedItem.notes.length > 100 ? `${normalizedItem.notes.substring(0, 100)}...` : normalizedItem.notes}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className={`verification-status-badge ${verificationStatus.colorClass}`}
              >
                {verificationStatus.text}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => handleStatusChange('Needs VR')}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-secondary"></div>
                  Needs VR
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('VR Pending')}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  VR Pending
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('AVS Pending')}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  AVS Pending
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('Verified')}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Verified
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete Button - Only visible when expanded, overlapping the top-right corner */}
      {isEditing && showActions && (
        <div className="absolute -top-2 -right-2 z-10">
          {!confirmingDelete ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              className="financial-item-delete-btn"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteConfirm}
                className="financial-item-confirm-btn financial-item-confirm-btn--approve"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteClick}
                className="financial-item-confirm-btn financial-item-confirm-btn--cancel"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Accordion Content (Editable Form) */}
      <div className={`financial-item-form-accordion ${isEditing ? 'financial-item-form-accordion--open' : 'financial-item-form-accordion--closed'}`}>
        {isEditing && (
          <form onSubmit={handleSaveClick} className="p-4 border-t space-y-4 bg-muted/20">
          <div>
            <Label htmlFor={`description-${item.id}`} className="block text-sm font-medium text-foreground mb-1">
              Description
            </Label>
            <Input
              type="text"
              id={`description-${item.id}`}
              value={normalizedFormData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`amount-${item.id}`} className="block text-sm font-medium text-foreground mb-1">
                Amount
              </Label>
              <Input
                type="number"
                id={`amount-${item.id}`}
                value={normalizedFormData.amount}
                onChange={(e) => handleChange('amount', parseNumericInput(e.target.value))}
                step="0.01"
                className="w-full"
              />
            </div>
            
            {itemType !== 'resources' && (
              <div>
                <Label htmlFor={`frequency-${item.id}`} className="block text-sm font-medium text-foreground mb-1">
                  Frequency
                </Label>
                <Select value={normalizedFormData.frequency} onValueChange={(value) => handleChange('frequency', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one-time">One-time</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`location-${item.id}`} className="block text-sm font-medium text-foreground mb-1">
                Institution/Location
              </Label>
              <Input
                type="text"
                id={`location-${item.id}`}
                value={normalizedFormData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="w-full"
              />
            </div>
            
            <div>
              <Label htmlFor={`accountNumber-${item.id}`} className="block text-sm font-medium text-foreground mb-1">
                Account Number
              </Label>
              <Input
                type="text"
                id={`accountNumber-${item.id}`}
                value={normalizedFormData.accountNumber}
                onChange={(e) => handleChange('accountNumber', e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <Label htmlFor={`notes-${item.id}`} className="block text-sm font-medium text-foreground mb-1">
              Notes
            </Label>
            <Textarea
              id={`notes-${item.id}`}
              value={normalizedFormData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full min-h-[60px] resize-y"
              placeholder="Add any relevant notes..."
            />
          </div>

          {shouldShowVerificationSource(item.verificationStatus, formData.verificationStatus) && (
            <div>
              <Label htmlFor={`verificationSource-${item.id}`} className="block text-sm font-medium text-foreground mb-1">
                Verification Source
              </Label>
              <Input
                type="text"
                id={`verificationSource-${item.id}`}
                value={normalizedFormData.verificationSource}
                onChange={(e) => handleChange('verificationSource', e.target.value)}
                className="w-full"
                placeholder="e.g., Bank Statement, Paystub"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="outline" onClick={handleCancelClick} className="flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Save
            </Button>
          </div>
          </form>
        )}
      </div>
    </div>
  );
}

interface FinancialItemListProps {
  items: FinancialItem[];
  itemType: CaseCategory;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onUpdate?: (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => void;
  onCreateItem?: (category: CaseCategory, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  title: string;
  showActions?: boolean;
  onAddSkeleton?: (addSkeletonFn: () => void) => void;
}

export function FinancialItemList({
  items = [],
  itemType,
  onDelete,
  onUpdate,
  onCreateItem,
  title,
  showActions = true,
  onAddSkeleton: externalOnAddSkeleton,
}: FinancialItemListProps) {
  const [skeletonCards, setSkeletonCards] = useState<string[]>([]);

  // Create a skeleton item for new cards
  const createSkeletonItem = (id: string): FinancialItem => ({
    id,
    description: '',
    amount: 0,
    verificationStatus: 'Needs VR',
    dateAdded: new Date().toISOString(),
  });

  // Handle adding a new skeleton card
  const handleAddSkeleton = () => {
    const skeletonId = `skeleton-${Date.now()}`;
    setSkeletonCards(prev => [...prev, skeletonId]);
  };

  // Register our handleAddSkeleton function with the parent
  useEffect(() => {
    if (externalOnAddSkeleton) {
      externalOnAddSkeleton(handleAddSkeleton);
    }
  }, [externalOnAddSkeleton]);

  // Handle saving a skeleton card
  const handleSaveSkeleton = async (skeletonId: string, itemData: FinancialItem) => {
    if (onCreateItem) {
      try {
        const { id, createdAt, updatedAt, ...createData } = itemData;
        await onCreateItem(itemType, createData);
        setSkeletonCards(prev => prev.filter(id => id !== skeletonId));
      } catch (error) {
        console.error('Failed to create item:', error);
      }
    }
  };

  // Handle cancelling a skeleton card
  const handleCancelSkeleton = (skeletonId: string) => {
    setSkeletonCards(prev => prev.filter(id => id !== skeletonId));
  };

  // Combine real items with skeleton items
  const allItems = [
    ...items,
    ...skeletonCards.map(id => createSkeletonItem(id))
  ];
  return (
    <div className={title ? "space-y-4" : ""}>
      {/* Header - only show if title is provided */}
      {title && (
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-medium text-foreground">{title}</h4>
          <Button
            size="sm"
            onClick={handleAddSkeleton}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      )}

      {/* Items list */}
      {allItems.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">
            No {itemType} items added yet
          </p>
        </div>
      ) : (
        <div className="space-y-2 group">
          {allItems.map((item, index) => {
            const isSkeleton = typeof item.id === 'string' && item.id.startsWith('skeleton-');
            const itemKey = item.id || `${itemType}-${index}`;
            return (
              <FinancialItemCard
                key={itemKey}
                item={item}
                itemType={itemType}
                onDelete={isSkeleton && item.id ? 
                  () => handleCancelSkeleton(item.id as string) : 
                  onDelete
                }
                onUpdate={isSkeleton ? 
                  (_, itemId, updatedItem) => handleSaveSkeleton(itemId, updatedItem) :
                  onUpdate
                }
                showActions={showActions}
                isSkeleton={isSkeleton}
                isEditing={isSkeleton} // Auto-expand skeleton cards
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FinancialItemGridProps {
  items: FinancialItem[];
  itemType: CaseCategory;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onAdd: (category: CaseCategory) => void;
  onUpdate?: (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => void;
  title: string;
  showActions?: boolean;
  columns?: 'auto' | 1 | 2 | 3 | 4;
}

export function FinancialItemGrid({
  items = [],
  itemType,
  onDelete,
  onAdd,
  onUpdate,
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
          {items.map((item, index) => {
            const itemKey = item.id || `${itemType}-${index}`;
            return (
              <FinancialItemCard
                key={itemKey}
                item={item}
                itemType={itemType}
                onDelete={onDelete}
                onUpdate={onUpdate}
                showActions={showActions}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}