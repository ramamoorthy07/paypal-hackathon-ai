const SENSITIVE_KEY = /secret|token|password|authorization|api[_-]?key/i;

export function redactPayload(value: unknown): string {
  return JSON.stringify(redactUnknown(value));
}

function redactUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactUnknown);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, nested]) => [key, SENSITIVE_KEY.test(key) ? "[redacted]" : redactUnknown(nested)],
    );
    return Object.fromEntries(entries);
  }

  return value;
}
