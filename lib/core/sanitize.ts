const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const HTML_TAGS = /<\/?[^>]+>/g;
const DANGEROUS_SCHEME = /(?:javascript|data|vbscript):/gi;

export function sanitizeUntrustedText(input: string, maxLen = 4000): string {
  return input
    .replace(HTML_TAGS, " ")
    .replace(DANGEROUS_SCHEME, "")
    .replace(ZERO_WIDTH, "")
    .replace(CONTROL_CHARS, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLen);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizeEmail(input: string): string | null {
  const value = sanitizeUntrustedText(input, 254).toLowerCase();
  if (!EMAIL_RE.test(value)) {
    return null;
  }
  return value;
}
