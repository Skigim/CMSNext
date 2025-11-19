import { FinancialItem } from '@/domain/financials/entities/FinancialItem';
import type { IFinancialRepository } from '@/domain/common/repositories/IFinancialRepository';

export interface GetFinancialItemsRequest {
  caseId: string;
}

export class GetFinancialItems {
  constructor(
    private readonly financialRepository: IFinancialRepository
  ) {}

  async execute(request: GetFinancialItemsRequest): Promise<FinancialItem[]> {
    return this.financialRepository.getByCaseId(request.caseId);
  }
}
