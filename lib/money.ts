export function centsToAmountString(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) {
    throw new Error("Amount must be a non-negative finite number of cents.");
  }
  return (cents / 100).toFixed(2);
}

export function isoDateFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
