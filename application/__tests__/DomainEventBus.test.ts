import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainEventBus } from '@/application/DomainEventBus';

describe('DomainEventBus', () => {
  let bus: DomainEventBus;

  beforeEach(() => {
    DomainEventBus.resetForTesting();
    bus = DomainEventBus.getInstance();
  });

  it('publishes events to subscribed handlers', async () => {
    const handler = vi.fn();
    bus.subscribe('CaseCreated', handler);

    await bus.publish(
      'CaseCreated',
      { id: 'test-id', name: 'Test Case' },
      { aggregateId: 'test-id' },
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CaseCreated',
        payload: { id: 'test-id', name: 'Test Case' },
        aggregateId: 'test-id',
        timestamp: expect.any(String),
      }),
    );
  });

  it('supports multiple handlers for the same event type', async () => {
    const handlerOne = vi.fn();
    const handlerTwo = vi.fn();

    bus.subscribe('CaseCreated', handlerOne);
    bus.subscribe('CaseCreated', handlerTwo);

    await bus.publish('CaseCreated', { id: 'test-id' });

    expect(handlerOne).toHaveBeenCalledOnce();
    expect(handlerTwo).toHaveBeenCalledOnce();
  });

  it('allows handlers to unsubscribe', async () => {
    const handler = vi.fn();
    const unsubscribe = bus.subscribe('CaseCreated', handler);

    unsubscribe();

    await bus.publish('CaseCreated', { id: 'test-id' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('isolates handler failures', async () => {
    const failingHandler = vi.fn().mockRejectedValue(new Error('handler failed'));
    const succeedingHandler = vi.fn();

    bus.subscribe('CaseCreated', failingHandler);
    bus.subscribe('CaseCreated', succeedingHandler);

    await bus.publish('CaseCreated', { id: 'test-id' });

    expect(failingHandler).toHaveBeenCalledOnce();
    expect(succeedingHandler).toHaveBeenCalledOnce();
  });
});
