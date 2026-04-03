/**
 * Alert Write Queue
 *
 * Manages background writes for alert status updates.
 * All alert writes are serialized through a single global FIFO queue to prevent
 * read-modify-write race conditions when multiple alerts are resolved in rapid succession.
 * Writes continue in background even if UI components unmount.
 */

import { createLogger } from './logger';

const logger = createLogger('AlertWriteQueue');

interface QueuedWrite {
  alertId: string;
  execute: () => Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

interface WriteQueueCallbacks {
  onSuccess?: (alertId: string) => void;
  onError?: (alertId: string, error: Error) => void;
}

/**
 * AlertWriteQueue
 *
 * Serializes ALL alert writes through a single global FIFO queue.
 * - Prevents read-modify-write races when multiple alert IDs are resolved concurrently
 * - Allows UI to update optimistically while writes persist
 * - Notifies callbacks on success/failure
 */
class AlertWriteQueue {
  private readonly queue: QueuedWrite[] = [];
  private isProcessing = false;
  private currentAlertId: string | null = null;
  private callbacks: WriteQueueCallbacks = {};

  /**
   * Set global callbacks for write results
   */
  setCallbacks(callbacks: WriteQueueCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Queue a write operation for an alert.
   * Returns immediately - write happens in background via the global serial queue.
   */
  enqueue(alertId: string, writeOperation: () => Promise<void>): void {
    this.queue.push({
      alertId,
      execute: writeOperation,
      resolve: () => {},
      reject: () => {},
    });

    if (!this.isProcessing) {
      void this.processQueue();
    }
  }

  /**
   * Queue a write and wait for it to complete.
   * Use this when the caller needs to know the result.
   */
  async enqueueAndWait(alertId: string, writeOperation: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ alertId, execute: writeOperation, resolve, reject });

      if (!this.isProcessing) {
        void this.processQueue();
      }
    });
  }

  /**
   * Drain the global write queue, processing one entry at a time.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const write = this.queue.shift()!;
        this.currentAlertId = write.alertId;

        try {
          await write.execute();
          write.resolve();
          this.callbacks.onSuccess?.(write.alertId);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error('Alert write failed', { alertId: write.alertId, error: err.message });
          write.reject(err);
          this.callbacks.onError?.(write.alertId, err);
        } finally {
          this.currentAlertId = null;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check if there are pending or in-flight writes for a specific alert ID.
   */
  hasPendingWrites(alertId: string): boolean {
    return this.currentAlertId === alertId || this.queue.some(w => w.alertId === alertId);
  }

  /**
   * Get count of total pending writes across all alerts (excludes the in-flight write).
   */
  getPendingCount(): number {
    return this.queue.length + (this.isProcessing ? 1 : 0);
  }

  /**
   * Clear all pending writes (for testing/cleanup).
   */
  clear(): void {
    this.queue.length = 0;
    this.currentAlertId = null;
    this.isProcessing = false;
  }
}

// Singleton instance
export const alertWriteQueue = new AlertWriteQueue();

