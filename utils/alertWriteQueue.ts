/**
 * Alert Write Queue
 * 
 * Manages background writes for alert status updates.
 * Ensures writes are serialized per alert ID to prevent race conditions.
 * Writes continue in background even if UI components unmount.
 */

import { createLogger } from './logger';

const logger = createLogger('AlertWriteQueue');

interface QueuedWrite<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

interface WriteQueueCallbacks {
  onSuccess?: (alertId: string) => void;
  onError?: (alertId: string, error: Error) => void;
}

/**
 * AlertWriteQueue
 * 
 * Serializes writes per alert ID and runs them in background.
 * - Prevents race conditions (resolve then reopen quickly)
 * - Allows UI to update optimistically while writes persist
 * - Notifies callbacks on success/failure
 */
class AlertWriteQueue {
  private readonly queues = new Map<string, QueuedWrite<void>[]>();
  private readonly processing = new Set<string>();
  private callbacks: WriteQueueCallbacks = {};

  /**
   * Set global callbacks for write results
   */
  setCallbacks(callbacks: WriteQueueCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Queue a write operation for an alert
   * Returns immediately - write happens in background
   */
  enqueue(alertId: string, writeOperation: () => Promise<void>): void {
    // Create a queued write with deferred promise handling
    const queuedWrite: QueuedWrite<void> = {
      execute: writeOperation,
      resolve: () => {},
      reject: () => {},
    };

    // Add to queue
    const queue = this.queues.get(alertId) ?? [];
    queue.push(queuedWrite);
    this.queues.set(alertId, queue);

    // Start processing if not already running for this alert
    if (!this.processing.has(alertId)) {
      this.processQueue(alertId);
    }
  }

  /**
   * Queue a write and wait for it to complete
   * Use this when you need to know the result
   */
  async enqueueAndWait(alertId: string, writeOperation: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      const queuedWrite: QueuedWrite<void> = {
        execute: writeOperation,
        resolve,
        reject,
      };

      const queue = this.queues.get(alertId) ?? [];
      queue.push(queuedWrite);
      this.queues.set(alertId, queue);

      if (!this.processing.has(alertId)) {
        this.processQueue(alertId);
      }
    });
  }

  /**
   * Process the queue for a specific alert ID
   */
  private async processQueue(alertId: string): Promise<void> {
    if (this.processing.has(alertId)) {
      return;
    }

    this.processing.add(alertId);

    try {
      while (true) {
        const queue = this.queues.get(alertId);
        if (!queue || queue.length === 0) {
          this.queues.delete(alertId);
          break;
        }

        const write = queue.shift()!;
        
        try {
          await write.execute();
          write.resolve();
          this.callbacks.onSuccess?.(alertId);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error('Alert write failed', { alertId, error: err.message });
          write.reject(err);
          this.callbacks.onError?.(alertId, err);
        }
      }
    } finally {
      this.processing.delete(alertId);
    }
  }

  /**
   * Check if there are pending writes for an alert
   */
  hasPendingWrites(alertId: string): boolean {
    const queue = this.queues.get(alertId);
    return (queue && queue.length > 0) || this.processing.has(alertId);
  }

  /**
   * Get count of total pending writes across all alerts
   */
  getPendingCount(): number {
    let count = 0;
    this.queues.forEach(queue => {
      count += queue.length;
    });
    return count + this.processing.size;
  }

  /**
   * Clear all pending writes (for testing/cleanup)
   */
  clear(): void {
    this.queues.clear();
    this.processing.clear();
  }
}

// Singleton instance
export const alertWriteQueue = new AlertWriteQueue();

