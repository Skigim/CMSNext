import { v4 as uuidv4 } from 'uuid';
import { FinancialItem, FinancialCategory, type FinancialVerificationStatus } from '@/domain/financials/entities/FinancialItem';
import type { ICaseRepository } from '@/domain/common/repositories/ICaseRepository';
import type { ITransactionRepository, TransactionOperation } from '@/domain/common/repositories/ITransactionRepository';
import { ValidationError } from '@/domain/common/errors/ValidationError';

export interface CreateFinancialItemRequest {
  caseId: string;
  category: FinancialCategory;
  description: string;
  amount: number;
  verificationStatus?: FinancialVerificationStatus;
  frequency?: string;
  location?: string;
  accountNumber?: string;
  verificationSource?: string;
  notes?: string;
  owner?: string;
}

export class CreateFinancialItem {
  constructor(
    private readonly caseRepository: ICaseRepository,
    private readonly transactionRepository: ITransactionRepository
  ) {}

  async execute(request: CreateFinancialItemRequest): Promise<FinancialItem> {
    // 1. Validate Parent Case exists
    const parentCase = await this.caseRepository.getById(request.caseId);
    if (!parentCase) {
      throw new ValidationError(`Case not found: ${request.caseId}`);
    }

    // 2. Create the Financial Item (Domain Entity)
    const newItem = FinancialItem.create({
      id: uuidv4(),
      caseId: request.caseId,
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Touch the Parent Case
    // This ensures the case's updatedAt timestamp reflects the new content
    parentCase.touch();

    // 4. Prepare Transaction
    const operations: TransactionOperation[] = [
      { type: 'save', domain: 'financials', entity: newItem },
      { type: 'save', domain: 'cases', entity: parentCase }
    ];

    // 5. Execute Atomic Save
    await this.transactionRepository.runTransaction(operations);

    return newItem;
  }
}
