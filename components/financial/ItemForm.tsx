/**
 * @deprecated This component has been replaced by FinancialItemModal
 * Use FinancialItemModal instead for new implementations
 */
import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { CaseItem, CaseCategory, NewCaseItemData } from "../../types/case";
import { X } from "lucide-react";

interface ItemFormProps {
  category: CaseCategory;
  item?: CaseItem;
  onSave: (itemData: NewCaseItemData) => void;
  onCancel: () => void;
}

export function ItemForm({ category, item, onSave, onCancel }: ItemFormProps) {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    amount: item?.amount || 0,
    status: item?.status || 'In Progress' as CaseItem['status'],
    description: item?.description || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Map the old status to verificationStatus
    const itemData = {
      ...formData,
      verificationStatus: 'Needs VR' as const // Default verification status
    };
    onSave(itemData);
  };

  const getCategoryTitle = (category: CaseCategory) => {
    switch (category) {
      case 'resources':
        return 'Resource';
      case 'income':
        return 'Income';
      case 'expenses':
        return 'Expense';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{item ? 'Edit' : 'Add'} {getCategoryTitle(category)}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={`Enter ${category} name`}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as CaseItem['status'] })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VR Pending">VR Pending</SelectItem>
                  <SelectItem value="UI Pending">UI Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Denied">Denied</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                {item ? 'Update' : 'Add'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}