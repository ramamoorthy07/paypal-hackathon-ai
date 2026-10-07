export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { warnIfEnvInvalid } = await import("./lib/env");
  warnIfEnvInvalid({ fatal: process.env.NODE_ENV === "production" });
}
