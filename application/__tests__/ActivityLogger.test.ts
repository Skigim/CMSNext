import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityLogger } from '@/application/ActivityLogger';
import { ApplicationState } from '@/application/ApplicationState';
import { DomainEventBus } from '@/application/DomainEventBus';
import type StorageRepository from '@/infrastructure/storage/StorageRepository';

describe('ActivityLogger', () => {
  let appState: ApplicationState;
  let eventBus: DomainEventBus;
  let storage: StorageRepository;
  let logger: ActivityLogger;
  let activitySave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ApplicationState.resetForTesting();
    DomainEventBus.resetForTesting();

    appState = ApplicationState.getInstance();
    eventBus = DomainEventBus.getInstance();

    activitySave = vi.fn().mockResolvedValue(undefined);

    storage = {
      activity: {
        save: activitySave,
      },
    } as unknown as StorageRepository;

    logger = new ActivityLogger(appState, storage, eventBus);
  });

  it('creates activity entry for CaseCreated events', async () => {
    logger.start();

    await eventBus.publish(
      'CaseCreated',
      {
        id: 'case-1',
        name: 'Test Case',
        mcn: 'MCN-001',
      },
      { aggregateId: 'case-1' },
    );

    const activities = appState.getActivities();
    expect(activities).toHaveLength(1);
    expect(activities[0].eventType).toBe('case.created');
    expect(activities[0].aggregateId).toBe('case-1');
    expect(activitySave).toHaveBeenCalledOnce();
  });

  it('cleans up subscriptions on stop', async () => {
    logger.start();
    logger.stop();

    await eventBus.publish(
      'CaseCreated',
      {
        id: 'case-1',
        name: 'Test Case',
      },
      { aggregateId: 'case-1' },
    );

    expect(appState.getActivities()).toHaveLength(0);
    expect(activitySave).not.toHaveBeenCalled();
  });
});
