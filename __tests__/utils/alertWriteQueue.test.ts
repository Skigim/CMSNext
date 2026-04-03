import { describe, it, expect, vi, beforeEach } from 'vitest';
import { alertWriteQueue } from '@/utils/alertWriteQueue';

vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('alertWriteQueue', () => {
  beforeEach(() => {
    alertWriteQueue.clear();
    alertWriteQueue.setCallbacks({});
  });

  describe('global serialization', () => {
    it('serializes writes for different alert IDs so they never run concurrently', async () => {
      // ARRANGE – track the order writes START and FINISH
      const order: string[] = [];

      const write1 = vi.fn(async () => {
        order.push('start-A');
        await Promise.resolve(); // yield to allow concurrent execution if not serialized
        order.push('end-A');
      });

      const write2 = vi.fn(async () => {
        order.push('start-B');
        await Promise.resolve();
        order.push('end-B');
      });

      // ACT – enqueue writes for two different alert IDs back-to-back
      alertWriteQueue.enqueue('alert-A', write1);
      alertWriteQueue.enqueue('alert-B', write2);

      // Wait for both writes to complete via enqueueAndWait on a third sentinel
      await alertWriteQueue.enqueueAndWait('alert-sentinel', async () => {});

      // ASSERT – writes must have executed sequentially (A fully before B starts)
      expect(order).toEqual(['start-A', 'end-A', 'start-B', 'end-B']);
    });

    it('serializes multiple writes for the same alert ID', async () => {
      // ARRANGE
      const order: string[] = [];

      const write1 = vi.fn(async () => {
        order.push('start-1');
        await Promise.resolve();
        order.push('end-1');
      });
      const write2 = vi.fn(async () => {
        order.push('start-2');
        await Promise.resolve();
        order.push('end-2');
      });

      // ACT
      alertWriteQueue.enqueue('alert-X', write1);
      alertWriteQueue.enqueue('alert-X', write2);

      await alertWriteQueue.enqueueAndWait('alert-X', async () => {});

      // ASSERT
      expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
    });

    it('invokes onSuccess callback after each successful write', async () => {
      // ARRANGE
      const onSuccess = vi.fn((alertId: string) => { void alertId; });
      alertWriteQueue.setCallbacks({ onSuccess });

      // ACT
      await alertWriteQueue.enqueueAndWait('alert-C', async () => {});

      // ASSERT
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith('alert-C');
    });

    it('invokes onError callback and continues processing after a failed write', async () => {
      // ARRANGE
      const onError = vi.fn((alertId: string, error: Error) => { void alertId; void error; });
      const onSuccess = vi.fn((alertId: string) => { void alertId; });
      alertWriteQueue.setCallbacks({ onError, onSuccess });

      const failingWrite = vi.fn(async () => {
        throw new Error('simulated write failure');
      });
      const successWrite = vi.fn(async () => {});

      // ACT – first write fails, second should still run
      alertWriteQueue.enqueue('alert-fail', failingWrite);

      let caughtError: Error | null = null;
      try {
        await alertWriteQueue.enqueueAndWait('alert-ok', successWrite);
      } catch (error) {
        caughtError = error instanceof Error ? error : new Error(String(error));
      }

      // ASSERT
      expect(caughtError).toBeNull();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith('alert-fail', expect.any(Error));
      expect(onSuccess).toHaveBeenCalledWith('alert-ok');
    });
  });

  describe('hasPendingWrites', () => {
    it('returns false when queue is empty', () => {
      expect(alertWriteQueue.hasPendingWrites('any-id')).toBe(false);
    });

    it('returns true while a write for that alertId is pending in the queue', async () => {
      // ARRANGE – block the queue with a long-running first write
      let resolveFirst!: () => void;
      const firstWritePromise = new Promise<void>(res => { resolveFirst = res; });

      alertWriteQueue.enqueue('blocker', async () => { await firstWritePromise; });
      alertWriteQueue.enqueue('target', async () => {});

      // ASSERT – 'target' is pending because 'blocker' is in-flight
      expect(alertWriteQueue.hasPendingWrites('target')).toBe(true);

      // ACT – unblock
      resolveFirst();
      await alertWriteQueue.enqueueAndWait('sentinel', async () => {});

      // ASSERT – target write has completed
      expect(alertWriteQueue.hasPendingWrites('target')).toBe(false);
    });
  });

  describe('getPendingCount', () => {
    it('returns 0 when nothing is queued', () => {
      expect(alertWriteQueue.getPendingCount()).toBe(0);
    });

    it('returns the correct count when multiple writes are queued', async () => {
      // ARRANGE – block the queue
      let resolveFirst!: () => void;
      const blocker = new Promise<void>(res => { resolveFirst = res; });

      alertWriteQueue.enqueue('a', async () => { await blocker; });
      alertWriteQueue.enqueue('b', async () => {});
      alertWriteQueue.enqueue('c', async () => {});

      // One in-flight + two queued = 3
      expect(alertWriteQueue.getPendingCount()).toBe(3);

      resolveFirst();
      await alertWriteQueue.enqueueAndWait('d', async () => {});
      expect(alertWriteQueue.getPendingCount()).toBe(0);
    });
  });

  describe('enqueueAndWait', () => {
    it('resolves after the write completes', async () => {
      // ARRANGE
      let executed = false;

      // ACT
      await alertWriteQueue.enqueueAndWait('alert-z', async () => {
        executed = true;
      });

      // ASSERT
      expect(executed).toBe(true);
    });

    it('rejects when the write throws', async () => {
      // ACT & ASSERT
      await expect(
        alertWriteQueue.enqueueAndWait('alert-err', async () => {
          throw new Error('write error');
        }),
      ).rejects.toThrow('write error');
    });
  });
});
