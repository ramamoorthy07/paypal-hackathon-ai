export function chatStreamErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/api key/i.test(message)) {
    return "OpenAI rejected the API key. Check OPENAI_API_KEY in .env.local.";
  }
  return "Chat failed. Try again.";
}
