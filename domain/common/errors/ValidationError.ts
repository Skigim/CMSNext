import { DomainError, type DomainErrorOptions } from './DomainError';

export class ValidationError extends DomainError {
  constructor(message: string, options: DomainErrorOptions = {}) {
    super(message, options);
    this.name = 'ValidationError';
  }
}

export default ValidationError;
