/**
 * Wraps a promise with a timeout. Rejects with a friendly message if exceeded.
 */
export const PAYMENT_TIMEOUT_MS = 30_000;

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage = "Tempo limite atingido. Tente novamente."
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}
