import type { IFinancialRepository } from '@/domain/common/repositories/IFinancialRepository';
import type { ICaseRepository } from '@/domain/common/repositories/ICaseRepository';
import type { ITransactionRepository, TransactionOperation } from '@/domain/common/repositories/ITransactionRepository';
import { ValidationError } from '@/domain/common/errors/ValidationError';

export interface DeleteFinancialItemRequest {
  id: string;
  caseId: string;
}

export class DeleteFinancialItem {
  constructor(
    private readonly financialRepository: IFinancialRepository,
    private readonly caseRepository: ICaseRepository,
    private readonly transactionRepository: ITransactionRepository
  ) {}

  async execute(request: DeleteFinancialItemRequest): Promise<void> {
    // 1. Fetch existing item
    const existingItem = await this.financialRepository.getById(request.id);
    if (!existingItem) {
      // Idempotent success - if it's gone, it's gone
      return;
    }

    // 2. Validate Case ID match
    if (existingItem.caseId !== request.caseId) {
      throw new ValidationError(`Financial item ${request.id} does not belong to case ${request.caseId}`);
    }

    // 3. Fetch Parent Case
    const parentCase = await this.caseRepository.getById(request.caseId);
    if (!parentCase) {
      throw new ValidationError(`Case not found: ${request.caseId}`);
    }

    // 4. Touch Parent Case
    parentCase.touch();

    // 5. Execute Transaction
    const operations: TransactionOperation[] = [
      { type: 'delete', domain: 'financials', id: request.id },
      { type: 'save', domain: 'cases', entity: parentCase }
    ];

    await this.transactionRepository.runTransaction(operations);
  }
}
