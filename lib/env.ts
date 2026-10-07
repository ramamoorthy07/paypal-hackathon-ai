import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  value === "" || value === undefined ? undefined : value;

const requiredString = z.preprocess(
  (value) => (value == null ? "" : value),
  z.string().trim().min(1, "required"),
);

const envSchema = z.object({
  PAYPAL_CLIENT_ID: requiredString,
  PAYPAL_CLIENT_SECRET: requiredString,
  PAYPAL_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  OPENAI_API_KEY: requiredString,
  AZURE_OPENAI_ENDPOINT: z.preprocess(emptyToUndefined, z.string().trim().url().optional()),
  AZURE_OPENAI_DEPLOYMENT: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).default("gpt-5-mini"),
  ),
  PAYPAL_WEBHOOK_ID: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  MAX_INVOICE_USD: z.coerce.number().positive().default(5000),
  DATABASE_URL: z.string().trim().min(1).default("file:./data/paypilot.db"),
  INR_USD_RATE: z.coerce.number().positive().default(0.012),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

function formatEnvError(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "env";
    return `- ${path}: ${issue.message}`;
  });

  return [
    "Invalid environment variables. Copy .env.example to .env.local and fill in values.",
    "Never put secrets in source control.",
    ...lines,
  ].join("\n");
}

function readEnv() {
  return envSchema.safeParse({
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
    PAYPAL_MODE: process.env.PAYPAL_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
    PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
    MAX_INVOICE_USD: process.env.MAX_INVOICE_USD,
    DATABASE_URL: process.env.DATABASE_URL,
    INR_USD_RATE: process.env.INR_USD_RATE,
  });
}

export function getEnv(): Env {
  if (cached) {
    return cached;
  }

  const parsed = readEnv();
  if (!parsed.success) {
    throw new Error(formatEnvError(parsed.error));
  }

  cached = parsed.data;
  return cached;
}

/** Logs missing secrets in `next dev`. Crashes only in production so local DB work can proceed. */
export function warnIfEnvInvalid(options: { fatal: boolean }): void {
  const parsed = readEnv();
  if (parsed.success) {
    cached = parsed.data;
    return;
  }

  const message = formatEnvError(parsed.error);
  if (options.fatal) {
    throw new Error(message);
  }
  console.error(message);
}

export function resetEnvCache(): void {
  cached = undefined;
}

export function paypalApiBase(mode: Env["PAYPAL_MODE"] = getEnv().PAYPAL_MODE): string {
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}
