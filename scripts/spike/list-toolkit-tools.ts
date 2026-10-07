import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { isPaypalReadToolName, paypalReadOnlyToolkitConfig } from "@/lib/paypal/read-tools";

const dummy = { clientId: "spike-client", clientSecret: "spike-secret" };

function names(allWrites: boolean): string[] {
  const toolkit = new PayPalAgentToolkit({
    ...dummy,
    configuration: allWrites
      ? {
          actions: {
            invoices: {
              create: true,
              list: true,
              send: true,
              sendReminder: true,
              cancel: true,
              search: true,
              delete: true,
            },
          },
          context: { sandbox: true },
        }
      : paypalReadOnlyToolkitConfig(true),
  });
  return Object.keys(toolkit.getTools()).sort();
}

function main(): void {
  const readOnly = names(false);
  const withWrites = names(true);
  const leakedWrites = readOnly.filter((name) => !isPaypalReadToolName(name));

  console.log("PayPal Agent Toolkit sandbox tool names (no secrets; dummy client).");
  console.log("Read-only allowlist (list + search):");
  for (const name of readOnly) {
    console.log(`  - ${name}`);
  }
  console.log("If create/send/remind were also enabled, toolkit would expose:");
  for (const name of withWrites) {
    console.log(`  - ${name}${isPaypalReadToolName(name) ? "" : "  [WRITE — blocked in PayPilot]"}`);
  }
  if (leakedWrites.length > 0) {
    console.error("Read-only config leaked write tools:", leakedWrites.join(", "));
    process.exit(1);
  }
}

main();
