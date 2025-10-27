export interface DomainErrorOptions {
  cause?: unknown;
  context?: Record<string, unknown>;
}

/**
 * Base error type for domain-level failures. Supports optional cause metadata
 * so upstream callers can retain stack traces without leaking infrastructure details.
 */
export class DomainError extends Error {
  readonly context?: Record<string, unknown>;

  constructor(message: string, options: DomainErrorOptions = {}) {
    super(message);
    this.name = 'DomainError';
    this.context = options.context;

    if ('cause' in options) {
      const errorWithCause = this as Error & { cause?: unknown };
      errorWithCause.cause = options.cause;
    }
  }
}

export default DomainError;
