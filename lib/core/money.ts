function hasLeadingMinus(text: string, amountStart: number): boolean {
  let i = amountStart - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === " " || ch === "$" || ch === "₹") {
      i -= 1;
      continue;
    }
    return ch === "-";
  }
  return false;
}

export function centsToAmountString(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) {
    throw new Error("Amount must be a non-negative finite number of cents.");
  }
  return (cents / 100).toFixed(2);
}

/** PayPal `amount.value` like `74.21` → integer cents. Rejects more than 2 decimal places. */
export function paypalMajorToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const frac = `${fraction}00`.slice(0, 2);
  return Number(whole) * 100 + Number(frac);
}

export function isoDateFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export type ParsedChatAmount = {
  currency: "USD" | "INR";
  majorUnits: number;
  minorUnits: number;
};

const AMOUNT_RE =
  /(?<![A-Za-z.])(-?\d{1,3}(?:,\d{3})+|-?\d+)(\.\d+)?\s*(k)?(?![A-Za-z])/gi;

const INR_MARK = /₹|\brs\.?|\binr\b/i;
const USD_MARK = /\$|\busd\b|\bdollars?\b/i;
const OTHER_FIAT_MARK = /€|\beuros?\b|\beur\b|\b£\b|\bgbp\b|\byen\b|\bjpy\b/i;
const REVISION_CUE =
  /\b(?:agreed|meant|instead|oops|finally)\b|\bcut\s+to\b|\bnot\s+[\$₹]/i;
const EMAIL_IN_TEXT = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

type AmountHit = ParsedChatAmount & {
  start: number;
  end: number;
  marked: boolean;
};

function isIsoDateHead(text: string, start: number, end: number): boolean {
  return /^\d{4}$/.test(text.slice(start, end)) && /^-\d{2}-\d{2}/.test(text.slice(end));
}

function lastWordBefore(text: string, start: number): string {
  let i = start - 1;
  while (i >= 0 && /\s/.test(text[i] ?? "")) {
    i -= 1;
  }
  const end = i + 1;
  while (i >= 0 && /[A-Za-z.]/.test(text[i] ?? "")) {
    i -= 1;
  }
  return text.slice(i + 1, end);
}

function firstWordAfter(text: string, end: number): string {
  let i = end;
  while (i < text.length && /\s/.test(text[i] ?? "")) {
    i += 1;
  }
  const start = i;
  while (i < text.length && /[A-Za-z]/.test(text[i] ?? "")) {
    i += 1;
  }
  return text.slice(start, i);
}

function currencyBeside(text: string, start: number, end: number): "USD" | "INR" | "other" | "bare" {
  const prev = text[start - 1];
  if (prev === "₹") {
    return "INR";
  }
  if (prev === "$") {
    return "USD";
  }
  if (prev === "€" || prev === "£") {
    return "other";
  }
  const before = lastWordBefore(text, start);
  const after = firstWordAfter(text, end);
  const beside = `${before} ${after}`;
  if (OTHER_FIAT_MARK.test(beside) && !INR_MARK.test(beside) && !USD_MARK.test(beside)) {
    return "other";
  }
  if (INR_MARK.test(beside)) {
    return "INR";
  }
  if (USD_MARK.test(beside)) {
    return "USD";
  }
  return "bare";
}

function collectAmounts(text: string): AmountHit[] {
  const hits: AmountHit[] = [];
  const re = new RegExp(AMOUNT_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (hasLeadingMinus(text, start) || isIsoDateHead(text, start, end)) {
      continue;
    }
    const kind = currencyBeside(text, start, end);
    if (kind === "other") {
      continue;
    }
    const intPart = (match[1] ?? "").replace(/,/g, "");
    const frac = match[2] ?? "";
    const thousand = Boolean(match[3]);
    let majorUnits = Number(`${intPart}${frac}`);
    if (!Number.isFinite(majorUnits) || majorUnits < 0) {
      continue;
    }
    if (thousand) {
      majorUnits *= 1000;
    }
    hits.push({
      currency: kind === "INR" ? "INR" : "USD",
      majorUnits,
      minorUnits: Math.round(majorUnits * 100),
      start,
      end,
      marked: kind === "INR" || kind === "USD",
    });
  }
  return hits;
}

/**
 * Invoice amount in messy freelancer chat: `$480`, `40k`, `₹40,000`.
 * Bare numbers (including `40k`) default to USD. Rupee markers force INR.
 * `minorUnits` are USD cents or INR paise.
 *
 * Refuses euros/other fiat, mixed INR+USD with no revision, and two client emails.
 * Prefers currency-marked amounts over "2 weeks" / dates. Revision cues
 * (`agreed`, `meant`, `cut to`, `oops`, `not $`) take the later amount.
 */
export function parseChatAmount(raw: string): ParsedChatAmount | null {
  const text = raw.normalize("NFKC");
  const emails = text.match(EMAIL_IN_TEXT) ?? [];
  if (new Set(emails.map((value) => value.toLowerCase())).size >= 2) {
    return null;
  }

  let hits = collectAmounts(text);
  if (hits.some((hit) => hit.marked)) {
    hits = hits.filter((hit) => hit.marked);
  }
  if (hits.length === 0) {
    return null;
  }

  const currencies = new Set(hits.map((hit) => hit.currency));
  const revised = REVISION_CUE.test(text);
  if (currencies.size > 1 && !revised) {
    return null;
  }

  const chosen = revised ? hits[hits.length - 1] : hits[0];
  if (!chosen) {
    return null;
  }
  return {
    currency: chosen.currency,
    majorUnits: chosen.majorUnits,
    minorUnits: chosen.minorUnits,
  };
}

/** INR paise × USD-per-INR labeled rate → USD cents. */
export function usdCentsFromInrPaise(inrPaise: number, usdPerInr: number): number {
  if (!Number.isFinite(inrPaise) || inrPaise < 0 || !Number.isFinite(usdPerInr) || usdPerInr <= 0) {
    throw new Error("INR conversion requires non-negative paise and a positive USD-per-INR rate.");
  }
  return Math.round(inrPaise * usdPerInr);
}
