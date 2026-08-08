// ===== In-Memory Queue =====
// Simple concurrent job queue for processing pages.
// For v1, runs in-process. Can be replaced with Redis/Bull later.

export interface QueueOptions {
  concurrency?: number;
}

export class Queue<T> {
  private items: T[] = [];
  private processing = 0;
  private concurrency: number;
  private processor: ((item: T) => Promise<void>) | null = null;
  private resolveIdle: (() => void) | null = null;

  constructor(options?: QueueOptions) {
    this.concurrency = options?.concurrency || 3;
  }

  /**
   * Set the function that processes each item
   */
  onProcess(handler: (item: T) => Promise<void>): void {
    this.processor = handler;
  }

  /**
   * Add items to the queue
   */
  add(items: T | T[]): void {
    const arr = Array.isArray(items) ? items : [items];
    this.items.push(...arr);
    console.log(`[Queue] Added ${arr.length} items (total: ${this.items.length}, processing: ${this.processing})`);
    this.processNext();
  }

  /**
   * Wait until all items are processed
   */
  async drain(): Promise<void> {
    if (this.items.length === 0 && this.processing === 0) {
      return;
    }
    
    return new Promise(resolve => {
      this.resolveIdle = resolve;
    });
  }

  /**
   * Get current queue stats
   */
  stats(): { queued: number; processing: number } {
    return {
      queued: this.items.length,
      processing: this.processing,
    };
  }

  private async processNext(): Promise<void> {
    if (!this.processor) return;
    if (this.processing >= this.concurrency) return;
    if (this.items.length === 0) {
      if (this.processing === 0 && this.resolveIdle) {
        this.resolveIdle();
        this.resolveIdle = null;
      }
      return;
    }

    const item = this.items.shift()!;
    this.processing++;

    try {
      await this.processor(item);
    } catch (error) {
      console.error('[Queue] Processing error:', error);
    } finally {
      this.processing--;
      this.processNext();
    }
  }
}
