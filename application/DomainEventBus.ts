import { createLogger } from '@/utils/logger';

const logger = createLogger('DomainEventBus');

export type DomainEventType =
  | 'CaseCreated'
  | 'CaseUpdated'
  | 'CaseDeleted'
  | 'CaseStatusChanged'
  | 'FinancialItemAdded'
  | 'FinancialItemUpdated'
  | 'FinancialItemDeleted'
  | 'NoteCreated'
  | 'NoteUpdated'
  | 'NoteDeleted'
  | 'AlertCreated'
  | 'AlertStatusChanged'
  | 'AlertResolved'
  | 'ActivityRecorded';

export interface DomainEvent<TPayload = unknown> {
  type: DomainEventType;
  payload: TPayload;
  timestamp: string;
  aggregateId?: string;
  metadata?: Record<string, unknown>;
}

type EventHandler<TPayload = unknown> = (
  event: DomainEvent<TPayload>,
) => void | Promise<void>;

/**
 * Singleton event bus for domain events.
 * Decouples domain operations from state updates and cross-cutting concerns.
 */
export class DomainEventBus {
  private static instance: DomainEventBus | null = null;
  private readonly handlers: Map<DomainEventType, Set<EventHandler>> = new Map();

  private constructor() {}

  static getInstance(): DomainEventBus {
    if (!DomainEventBus.instance) {
      DomainEventBus.instance = new DomainEventBus();
    }

    return DomainEventBus.instance;
  }

  /**
   * Subscribe to a domain event type.
   * Returns an unsubscribe function for cleanup.
   */
  subscribe<TPayload = unknown>(
    eventType: DomainEventType,
    handler: EventHandler<TPayload>,
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.add(handler as EventHandler);

    logger.debug('Handler subscribed', { eventType });

    return () => {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
      logger.debug('Handler unsubscribed', { eventType });
    };
  }

  /**
   * Publish a domain event to all subscribers.
   */
  async publish<TPayload = unknown>(
    type: DomainEventType,
    payload: TPayload,
    options?: { aggregateId?: string; metadata?: Record<string, unknown> },
  ): Promise<void> {
    const event: DomainEvent<TPayload> = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      aggregateId: options?.aggregateId,
      metadata: options?.metadata,
    };

    logger.info('Event published', {
      type,
      aggregateId: event.aggregateId,
      hasMetadata: Boolean(event.metadata),
    });

    const handlers = this.handlers.get(type);
    if (!handlers || handlers.size === 0) {
      logger.debug('No handlers for event', { type });
      return;
    }

    const promises = Array.from(handlers).map(handler =>
      Promise.resolve(handler(event)).catch(error => {
        logger.error('Event handler failed', { type, error });
      }),
    );

    await Promise.all(promises);
  }

  /**
   * Clear all handlers (testing utility).
   */
  clear(): void {
    this.handlers.clear();
    logger.debug('All handlers cleared');
  }

  /**
   * Reset singleton instance (testing utility).
   */
  static resetForTesting(): void {
    DomainEventBus.instance = null;
  }
}

export default DomainEventBus;
