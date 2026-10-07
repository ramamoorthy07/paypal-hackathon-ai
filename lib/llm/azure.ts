export function azureOpenAiBaseUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/openai/v1")) {
    return trimmed;
  }
  if (trimmed.endsWith("/openai")) {
    return `${trimmed}/v1`;
  }
  return `${trimmed}/openai/v1`;
}
