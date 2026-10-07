export function plainTextFromGenerateResult(result: {
  text: string;
  content: Array<{ type: string; text?: string }>;
}): string {
  const direct = result.text.trim();
  if (direct) {
    return direct;
  }
  return result.content
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join("\n")
    .trim();
}
