export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { getEnv } = await import("./lib/env");
  getEnv();
}
