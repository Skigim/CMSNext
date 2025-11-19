import { FinancialItem, FinancialCategory, type FinancialVerificationStatus } from '@/domain/financials/entities/FinancialItem';
import type { IFinancialRepository } from '@/domain/common/repositories/IFinancialRepository';
import type { ICaseRepository } from '@/domain/common/repositories/ICaseRepository';
import type { ITransactionRepository, TransactionOperation } from '@/domain/common/repositories/ITransactionRepository';
import { ValidationError } from '@/domain/common/errors/ValidationError';

export interface UpdateFinancialItemRequest {
  id: string;
  caseId: string;
  category?: FinancialCategory;
  description?: string;
  amount?: number;
  verificationStatus?: FinancialVerificationStatus;
  frequency?: string;
  location?: string;
  accountNumber?: string;
  verificationSource?: string;
  notes?: string;
  owner?: string;
}

export class UpdateFinancialItem {
  constructor(
    private readonly financialRepository: IFinancialRepository,
    private readonly caseRepository: ICaseRepository,
    private readonly transactionRepository: ITransactionRepository
  ) {}

  async execute(request: UpdateFinancialItemRequest): Promise<FinancialItem> {
    // 1. Fetch existing item
    let existingItem = await this.financialRepository.getById(request.id);
    if (!existingItem) {
      throw new ValidationError(`Financial item not found: ${request.id}`);
    }

    // Defensive fix: Ensure existingItem is an instance
    if (!(existingItem instanceof FinancialItem)) {
        console.warn('UpdateFinancialItem: existingItem is not an instance, rehydrating...', existingItem);
        // Assuming existingItem is a plain object matching the snapshot structure
        existingItem = FinancialItem.rehydrate(existingItem as any);
    }

    // 2. Validate Case ID match (security check)
    if (existingItem.caseId !== request.caseId) {
      throw new ValidationError(`Financial item ${request.id} does not belong to case ${request.caseId}`);
    }

    // 3. Fetch Parent Case (for timestamp update)
    const parentCase = await this.caseRepository.getById(request.caseId);
    if (!parentCase) {
      throw new ValidationError(`Case not found: ${request.caseId}`);
    }

    // 4. Update the Item
    const updatedItem = existingItem.applyUpdates({
      category: request.category,
      description: request.description,
      amount: request.amount,
      verificationStatus: request.verificationStatus,
      frequency: request.frequency,
      location: request.location,
      accountNumber: request.accountNumber,
      verificationSource: request.verificationSource,
      notes: request.notes,
      owner: request.owner,
    });

    // 5. Touch Parent Case
    parentCase.touch();

    // 6. Execute Transaction
    const operations: TransactionOperation[] = [
      { type: 'save', domain: 'financials', entity: updatedItem },
      { type: 'save', domain: 'cases', entity: parentCase }
    ];

    await this.transactionRepository.runTransaction(operations);

    return updatedItem;
  }
}
