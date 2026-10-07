import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { EVAL_CASES, runEvals } from "@/lib/agent/evals";

function markdown(): string {
  const { total, passed, failed, results } = runEvals();
  const lines = [
    "# PayPilot parser evals",
    "",
    `Headline: **${passed}/${total}** cases passed on \`npm run eval\`.`,
    "",
    "These cases score deterministic parsers and policy (`parseChatAmount` + `evaluateProposal`). The chat model still drafts invoices; it cannot create or send PayPal invoices. Arithmetic stays in code.",
    "",
    "| id | category | result | detail |",
    "| --- | --- | --- | --- |",
    ...results.map(
      (row) => `| ${row.id} | ${row.category} | ${row.ok ? "pass" : "FAIL"} | ${row.detail.replace(/\|/g, "/")} |`,
    ),
    "",
    failed.length === 0 ? "All cases passed." : `${failed.length} failure(s).`,
    "",
  ];
  return lines.join("\n");
}

const report = markdown();
const out = resolve(process.cwd(), "docs/EVALS.md");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, report);
process.stdout.write(report);
process.stdout.write("\n");
const { total, passed } = runEvals();
if (EVAL_CASES.length !== 40) {
  console.error(`Expected 40 eval cases, found ${EVAL_CASES.length}.`);
  process.exit(1);
}
if (passed !== total) {
  process.exit(1);
}
