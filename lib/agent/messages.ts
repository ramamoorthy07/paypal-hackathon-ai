import type { UIMessage } from "ai";

function asRole(value: unknown): UIMessage["role"] {
  if (value === "assistant" || value === "system") {
    return value;
  }
  return "user";
}

/**
 * Accepts AI SDK UI messages (`parts`) or the simpler `{ role, content }` shape
 * used by curl and early clients.
 */
export function toUiMessages(raw: unknown[]): UIMessage[] {
  return raw.map((item, index) => {
    if (!item || typeof item !== "object") {
      return {
        id: String(index),
        role: "user",
        parts: [{ type: "text", text: String(item ?? "") }],
      };
    }

    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === "string" && rec.id.length > 0 ? rec.id : String(index);
    const role = asRole(rec.role);

    if (Array.isArray(rec.parts)) {
      return { id, role, parts: rec.parts } as UIMessage;
    }

    const text = typeof rec.content === "string" ? rec.content : "";
    return { id, role, parts: [{ type: "text", text }] };
  });
}
