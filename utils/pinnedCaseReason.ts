export const MAX_PIN_REASON_LENGTH = 240;

export function sanitizePinReason(reason?: string): string | undefined {
  const trimmedReason = reason?.trim();
  if (!trimmedReason) {
    return undefined;
  }

  return trimmedReason.slice(0, MAX_PIN_REASON_LENGTH);
}