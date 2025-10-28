import { ApplicationState } from '@/application/ApplicationState';
import { DomainEventBus, type DomainEvent } from '@/application/DomainEventBus';
import { ActivityEvent } from '@/domain/activity/entities/ActivityEvent';
import type { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import { createLogger } from '@/utils/logger';

const logger = createLogger('ActivityLogger');

type Unsubscribe = () => void;

function resolveAggregateId(event: DomainEvent): string {
  if (event.aggregateId) {
    return event.aggregateId;
  }

  if (event.payload && typeof event.payload === 'object' && 'id' in event.payload) {
    const maybeId = (event.payload as { id?: string }).id;
    if (maybeId) {
      return maybeId;
    }
  }

  return 'unknown';
}

function normaliseMetadata(event: DomainEvent): Record<string, unknown> {
  return {
    ...(event.metadata ?? {}),
    domainEventType: event.type,
  };
}

/**
 * Subscribes to domain events and creates activity log entries.
 */
export class ActivityLogger {
  private unsubscribers: Unsubscribe[] = [];

  constructor(
    private readonly appState: ApplicationState,
    private readonly storage: StorageRepository,
    private readonly eventBus: DomainEventBus = DomainEventBus.getInstance(),
  ) {}

  start(): void {
    this.stop();

    logger.info('Starting activity logger');

    this.unsubscribers.push(
      this.eventBus.subscribe('CaseCreated', event => this.handleCaseCreated(event)),
    );

    this.unsubscribers.push(
      this.eventBus.subscribe('CaseUpdated', event => this.handleCaseUpdated(event)),
    );

    this.unsubscribers.push(
      this.eventBus.subscribe('CaseDeleted', event => this.handleCaseDeleted(event)),
    );

    logger.info('Activity logger subscribed to domain events', {
      subscriptionCount: this.unsubscribers.length,
    });
  }

  stop(): void {
    if (this.unsubscribers.length === 0) {
      return;
    }

    this.unsubscribers.forEach(unsub => {
      try {
        unsub();
      } catch (error) {
        logger.warn('Failed to unsubscribe activity listener', { error });
      }
    });

    this.unsubscribers = [];
    logger.info('Activity logger stopped');
  }

  private async handleCaseCreated(event: DomainEvent): Promise<void> {
    const aggregateId = resolveAggregateId(event);

    const activity = ActivityEvent.create({
      eventType: 'case.created',
      aggregateId,
      aggregateType: 'case',
      changes: {
        after: event.payload,
      },
      timestamp: event.timestamp,
      metadata: normaliseMetadata(event),
    });

    await this.persistActivity(activity);
  }

  private async handleCaseUpdated(event: DomainEvent): Promise<void> {
    const aggregateId = resolveAggregateId(event);

    const activity = ActivityEvent.create({
      eventType: 'case.updated',
      aggregateId,
      aggregateType: 'case',
      changes: {
        after: event.payload,
      },
      timestamp: event.timestamp,
      metadata: normaliseMetadata(event),
    });

    await this.persistActivity(activity);
  }

  private async handleCaseDeleted(event: DomainEvent): Promise<void> {
    const aggregateId = resolveAggregateId(event);

    const activity = ActivityEvent.create({
      eventType: 'case.deleted',
      aggregateId,
      aggregateType: 'case',
      changes: {
        before: event.payload,
        deleted: true,
      },
      timestamp: event.timestamp,
      metadata: normaliseMetadata(event),
    });

    await this.persistActivity(activity);
  }

  private async persistActivity(activity: ActivityEvent): Promise<void> {
    try {
      this.appState.upsertActivity(activity);
      await this.storage.activity.save(activity);
      logger.debug('Activity event recorded', {
        eventType: activity.eventType,
        aggregateId: activity.aggregateId,
      });
    } catch (error) {
      logger.error('Failed to persist activity event', {
        error,
        eventType: activity.eventType,
        aggregateId: activity.aggregateId,
      });
    }
  }
}

export default ActivityLogger;
