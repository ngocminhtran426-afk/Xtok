// ===== Retry with Exponential Backoff =====

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 5,
  initialDelayMs: 60_000, // 1 minute
  maxDelayMs: 480_000,    // 8 minutes
};

/**
 * Retry a function with exponential backoff.
 * 
 * Delays: 1m → 2m → 4m → 8m → 8m (capped)
 * 
 * Does NOT retry indefinitely.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_OPTIONS.maxAttempts;
  const initialDelay = options?.initialDelayMs ?? DEFAULT_OPTIONS.initialDelayMs;
  const maxDelay = options?.maxDelayMs ?? DEFAULT_OPTIONS.maxDelayMs;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxAttempts) {
        break;
      }

      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
      
      if (options?.onRetry) {
        options.onRetry(attempt, lastError);
      }
      
      console.log(`[Retry] Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying in ${delay / 1000}s...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
