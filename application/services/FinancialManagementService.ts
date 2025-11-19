import { toast } from "sonner";
import { ApplicationState } from "../ApplicationState";
import { StorageRepository } from "../../infrastructure/storage/StorageRepository";
import { CreateFinancialItem } from "../../domain/financials/useCases/CreateFinancialItem";
import { UpdateFinancialItem } from "../../domain/financials/useCases/UpdateFinancialItem";
import { DeleteFinancialItem } from "../../domain/financials/useCases/DeleteFinancialItem";
import { GetFinancialItems } from "../../domain/financials/useCases/GetFinancialItems";
import { FinancialItem } from "../../domain/financials/entities/FinancialItem";
import { CaseCategory } from "../../types/case";

export class FinancialManagementService {
  private createUseCase: CreateFinancialItem;
  private updateUseCase: UpdateFinancialItem;
  private deleteUseCase: DeleteFinancialItem;
  private getUseCase: GetFinancialItems;

  constructor(
    private readonly appState: ApplicationState,
    repository: StorageRepository
  ) {
    this.createUseCase = new CreateFinancialItem(repository.cases, repository);
    this.updateUseCase = new UpdateFinancialItem(repository.financials, repository.cases, repository);
    this.deleteUseCase = new DeleteFinancialItem(repository.financials, repository.cases, repository);
    this.getUseCase = new GetFinancialItems(repository.financials);
  }

  async createItem(
    caseId: string,
    category: CaseCategory,
    data: Omit<FinancialItem, "id" | "createdAt" | "updatedAt" | "caseId" | "category">
  ): Promise<FinancialItem> {
    const toastId = toast.loading("Adding financial item...");

    try {
      // 1. Execute Use Case (this handles validation, entity creation, and persistence)
      const newItem = await this.createUseCase.execute({
        caseId,
        category: category as any, // Cast to FinancialCategory
        amount: data.amount,
        description: data.description,
        verificationStatus: data.verificationStatus,
        frequency: data.frequency,
        location: data.location,
        accountNumber: data.accountNumber,
        verificationSource: data.verificationSource,
        notes: data.notes,
        owner: data.owner,
      });

      // 2. Update Application State
      this.appState.upsertFinancialItem(newItem);
      
      // Also need to update the parent case's updatedAt in state
      const parentCase = this.appState.getCase(caseId);
      if (parentCase) {
          parentCase.touch();
          this.appState.updateCase(caseId, parentCase.toJSON());
      }

      toast.success("Financial item added", { id: toastId });
      return newItem;
    } catch (error) {
      console.error("Failed to create financial item", error);
      toast.error("Failed to add item", { id: toastId });
      throw error;
    }
  }

  async updateItem(
    itemId: string,
    updates: Partial<Omit<FinancialItem, "id" | "caseId" | "createdAt" | "updatedAt">>
  ): Promise<FinancialItem> {
    const toastId = toast.loading("Updating financial item...");
    
    const originalItem = this.appState.getFinancialItem(itemId);
    if (!originalItem) {
        toast.dismiss(toastId);
        throw new Error("Item not found in state");
    }

    try {
      // 1. Execute Use Case
      const updatedItem = await this.updateUseCase.execute({
        id: itemId,
        caseId: originalItem.caseId,
        category: updates.category as any,
        description: updates.description,
        amount: updates.amount,
        verificationStatus: updates.verificationStatus,
        frequency: updates.frequency,
        location: updates.location,
        accountNumber: updates.accountNumber,
        verificationSource: updates.verificationSource,
        notes: updates.notes,
        owner: updates.owner,
      });

      // 2. Update State
      this.appState.upsertFinancialItem(updatedItem);
      
      // Update parent case timestamp in state
      const parentCase = this.appState.getCase(updatedItem.caseId);
      if (parentCase) {
          parentCase.touch();
          this.appState.updateCase(updatedItem.caseId, parentCase.toJSON());
      }

      toast.success("Financial item updated", { id: toastId });
      return updatedItem;
    } catch (error) {
      console.error("Failed to update financial item", error);
      toast.error("Failed to update item", { id: toastId });
      throw error;
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    const toastId = toast.loading("Deleting financial item...");
    
    const item = this.appState.getFinancialItem(itemId);
    if (!item) {
        toast.dismiss(toastId);
        return;
    }
    const caseId = item.caseId;

    try {
      await this.deleteUseCase.execute({ id: itemId, caseId });

      this.appState.removeFinancialItem(itemId);
      
      const parentCase = this.appState.getCase(caseId);
      if (parentCase) {
          parentCase.touch();
          this.appState.updateCase(caseId, parentCase.toJSON());
      }

      toast.success("Financial item deleted", { id: toastId });
    } catch (error) {
      console.error("Failed to delete financial item", error);
      toast.error("Failed to delete item", { id: toastId });
      throw error;
    }
  }
  
  async getItems(caseId: string): Promise<FinancialItem[]> {
      const items = await this.getUseCase.execute({ caseId });
      
      // Sync state
      items.forEach(item => this.appState.upsertFinancialItem(item));
      
      return items;
  }
}
