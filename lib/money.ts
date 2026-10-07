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

export function isoDateFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export type ParsedChatAmount = {
  currency: "USD" | "INR";
  majorUnits: number;
  minorUnits: number;
};

const AMOUNT_RE =
  /(?<![A-Za-z.])(-?\d{1,3}(?:,\d{3})+|-?\d+)(\.\d+)?\s*(k)?(?![A-Za-z])/i;

/**
 * First amount in messy freelancer chat: `$480`, `40k`, `₹40,000`.
 * Bare numbers (including `40k`) default to USD. Rupee markers force INR.
 * `minorUnits` are USD cents or INR paise.
 */
export function parseChatAmount(raw: string): ParsedChatAmount | null {
  const text = raw.normalize("NFKC");
  const match = AMOUNT_RE.exec(text);
  if (!match || match.index === undefined) {
    return null;
  }

  const start = match.index;
  const end = start + match[0].length;
  if (hasLeadingMinus(text, start)) {
    return null;
  }
  const around = `${text.slice(Math.max(0, start - 10), start)}${match[0]}${text.slice(end, end + 10)}`;

  let currency: "USD" | "INR" = "USD";
  if (/₹|\brs\.?|\binr\b/i.test(around)) {
    currency = "INR";
  } else if (/\$|\busd\b|\bdollars?\b/i.test(around)) {
    currency = "USD";
  }

  const intPart = (match[1] ?? "").replace(/,/g, "");
  const frac = match[2] ?? "";
  const thousand = Boolean(match[3]);
  let majorUnits = Number(`${intPart}${frac}`);
  if (!Number.isFinite(majorUnits) || majorUnits < 0) {
    return null;
  }
  if (thousand) {
    majorUnits *= 1000;
  }

  return {
    currency,
    majorUnits,
    minorUnits: Math.round(majorUnits * 100),
  };
}

/** INR paise × USD-per-INR labeled rate → USD cents. */
export function usdCentsFromInrPaise(inrPaise: number, usdPerInr: number): number {
  if (!Number.isFinite(inrPaise) || inrPaise < 0 || !Number.isFinite(usdPerInr) || usdPerInr <= 0) {
    throw new Error("INR conversion requires non-negative paise and a positive USD-per-INR rate.");
  }
  return Math.round(inrPaise * usdPerInr);
}
