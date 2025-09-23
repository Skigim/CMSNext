import { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { FinancialItem, CaseCategory } from "../types/case";
import { Trash2, Check, X, Plus, StickyNote, Landmark, Wallet, Receipt } from "lucide-react";

interface FinancialItemCardProps {
  item: FinancialItem;
  itemType: CaseCategory;
  onEdit: (category: CaseCategory, itemId: string) => void;
  onDelete: (category: CaseCategory, itemId: string) => void;
  onUpdate?: (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => void;
  showActions?: boolean;
  isSkeleton?: boolean;
  isEditing?: boolean;
}

export function FinancialItemCard({
  item,
  itemType,
  onEdit,
  onDelete,
  onUpdate,
  showActions = true,
  isSkeleton = false,
  isEditing: initialIsEditing = false,
}: FinancialItemCardProps) {
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [formData, setFormData] = useState(item);

  // Update form data when item changes (important for skeleton cards)
  useState(() => {
    setFormData(item);
  });

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
    } else {
      // Fall back to modal editing
      if (typeof item.id === 'string') {
        onEdit(itemType, item.id);
      }
    }
  };

  const handleCancelClick = () => {
    if (isSkeleton && onDelete && typeof item.id === 'string') {
      onDelete(itemType, item.id); // For skeleton cards, remove from list
    } else {
      setIsEditing(false);
      setFormData(item); // Reset form data
    }
  };

  const handleSaveClick = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[FinancialItemCard] handleSaveClick triggered', { itemId: item.id, itemType, formData, hasOnUpdate: !!onUpdate });
    
    if (onUpdate && typeof item.id === 'string') {
      try {
        console.log('[FinancialItemCard] Calling onUpdate with:', { itemType, itemId: item.id, formData });
        await onUpdate(itemType, item.id, formData);
        console.log('[FinancialItemCard] onUpdate completed successfully');
        setIsEditing(false);
      } catch (error) {
        console.error('[FinancialItemCard] Failed to update item:', error);
      }
    } else {
      console.warn('[FinancialItemCard] Cannot save: missing onUpdate handler or invalid item.id', {
        hasOnUpdate: !!onUpdate,
        itemId: item.id,
        itemIdType: typeof item.id
      });
    }
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

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
    if (typeof item.id === 'string') {
      onDelete(itemType, item.id);
    }
    setConfirmingDelete(false);
  };

  // Handle quick verification status change
  const handleStatusClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card expansion
    
    if (!onUpdate || typeof item.id !== 'string') return;
    
    // Define status cycle order
    const statusCycle: Array<'Needs VR' | 'VR Pending' | 'AVS Pending' | 'Verified'> = [
      'Needs VR',
      'VR Pending', 
      'AVS Pending',
      'Verified'
    ];
    
    const currentStatus = item.verificationStatus || 'Needs VR';
    const currentIndex = statusCycle.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statusCycle.length;
    const nextStatus = statusCycle[nextIndex];
    
    try {
      // Update the verification status
      await onUpdate(itemType, item.id, {
        ...item,
        verificationStatus: nextStatus,
        // Clear verification source if moving away from 'Verified'
        ...(nextStatus !== 'Verified' && { verificationSource: undefined })
      });
    } catch (error) {
      console.error('Failed to update verification status:', error);
    }
  };

  const verificationStatus = getVerificationStatus();

  return (
    <div className={`bg-card border rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 ease-in-out w-full relative ${isSkeleton ? 'border-dashed border-primary/50 bg-primary/5' : ''}`}>
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
              <p className="font-semibold text-foreground">{item.description || item.name || 'Untitled Item'}</p>
              <p className="text-sm text-muted-foreground">
                {item.dateAdded ? new Date(item.dateAdded).toLocaleDateString() : 'No date'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-lg font-mono text-foreground">{getDisplayAmount()}</p>
          </div>
        </div>

        {/* Additional info row */}
        <div className="flex justify-between items-center mt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.location && <span>{item.location}</span>}
            {item.accountNumber && <span>{formatAccountNumber(item.accountNumber)}</span>}
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
          <Badge 
            variant={verificationStatus.variant} 
            className="text-xs cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200 select-none border border-current/20"
            onClick={handleStatusClick}
            title="Click to cycle through verification statuses"
          >
            {verificationStatus.text}
          </Badge>
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
              className="h-8 w-8 p-0 bg-background/90 backdrop-blur-sm border border-border/50 text-destructive hover:text-destructive hover:bg-destructive/10 shadow-sm hover:animate-pulse hover:scale-110 transition-all duration-200"
              style={{
                animation: 'wiggle 0.3s ease-in-out'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.animation = 'wiggle 0.3s ease-in-out infinite';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.animation = '';
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteConfirm}
                className="h-8 w-8 p-0 bg-background/90 backdrop-blur-sm border border-border/50 text-green-600 hover:text-green-700 hover:bg-green-50 shadow-sm"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteClick}
                className="h-8 w-8 p-0 bg-background/90 backdrop-blur-sm border border-border/50 text-red-600 hover:text-red-700 hover:bg-red-50 shadow-sm"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Accordion Content (Editable Form) */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isEditing ? 'max-h-[500px]' : 'max-h-0'}`}>
        <form onSubmit={handleSaveClick} className="p-4 border-t space-y-4 bg-muted/20">
          <div>
            <Label htmlFor={`description-${item.id}`} className="block text-sm font-medium text-foreground mb-1">
              Description
            </Label>
            <Input
              type="text"
              id={`description-${item.id}`}
              value={formData.description || ''}
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
                value={formData.amount || ''}
                onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
                step="0.01"
                className="w-full"
              />
            </div>
            
            {itemType !== 'resources' && (
              <div>
                <Label htmlFor={`frequency-${item.id}`} className="block text-sm font-medium text-foreground mb-1">
                  Frequency
                </Label>
                <Select value={formData.frequency || ''} onValueChange={(value) => handleChange('frequency', value)}>
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
                value={formData.location || ''}
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
                value={formData.accountNumber || ''}
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
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`verificationStatus-${item.id}`} className="block text-sm font-medium text-foreground mb-1">
                Verification Status
              </Label>
              <Select value={formData.verificationStatus || 'Needs VR'} onValueChange={(value) => handleChange('verificationStatus', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Needs VR">Needs VR</SelectItem>
                  <SelectItem value="VR Pending">VR Pending</SelectItem>
                  <SelectItem value="AVS Pending">AVS Pending</SelectItem>
                  <SelectItem value="Verified">Verified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {formData.verificationStatus === 'Verified' && (
              <div>
                <Label htmlFor={`verificationSource-${item.id}`} className="block text-sm font-medium text-foreground mb-1">
                  Verification Source
                </Label>
                <Input
                  type="text"
                  id={`verificationSource-${item.id}`}
                  value={formData.verificationSource || ''}
                  onChange={(e) => handleChange('verificationSource', e.target.value)}
                  className="w-full"
                  placeholder="e.g., Bank Statement, Paystub"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="outline" onClick={handleCancelClick} className="flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </Button>
            <Button 
              type="submit" 
              onClick={() => {
                console.log('[FinancialItemCard] Save button clicked directly');
                // Let the form submission handle it, but also log the direct click
              }}
              className="flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface FinancialItemListProps {
  items: FinancialItem[];
  itemType: CaseCategory;
  onEdit: (category: CaseCategory, itemId: string) => void;
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
  onEdit,
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
            return (
              <FinancialItemCard
                key={item.id || `${itemType}-${index}`}
                item={item}
                itemType={itemType}
                onEdit={onEdit}
                onDelete={isSkeleton && typeof item.id === 'string' ? 
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
  onEdit: (category: CaseCategory, itemId: string) => void;
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
  onEdit,
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
          {items.map((item, index) => (
            <FinancialItemCard
              key={item.id || `${itemType}-${index}`}
              item={item}
              itemType={itemType}
              onEdit={onEdit}
              onDelete={onDelete}
              onUpdate={onUpdate}
              showActions={showActions}
            />
          ))}
        </div>
      )}
    </div>
  );
}