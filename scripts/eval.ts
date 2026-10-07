import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { EVAL_CASES, HELD_OUT_CASES, runEvals, type EvalRunResult } from "@/lib/agent/evals";

/** Measured against first-amount parseChatAmount before any parser change. */
const HELD_OUT_BASELINE = {
  passed: 6,
  total: 15,
  failures: [
    { id: "hold-conflict-agreed", detail: "got USD 40000" },
    { id: "hold-conflict-not", detail: "got USD 12000" },
    { id: "hold-euros", detail: "expected null, got USD 48000" },
    { id: "hold-dual-currency", detail: "expected null, got INR 4000000" },
    { id: "hold-meant-usd", detail: "got INR 4000000" },
    { id: "hold-two-clients", detail: "expected null, got USD 12000" },
    { id: "hold-iso-date-prefix", detail: "got USD 202600" },
    { id: "hold-cut-to", detail: "got USD 4000000" },
    { id: "hold-long-thread", detail: "got USD 200" },
  ],
};

function table(results: EvalRunResult[]): string {
  return [
    "| id | category | result | detail |",
    "| --- | --- | --- | --- |",
    ...results.map(
      (row) => `| ${row.id} | ${row.category} | ${row.ok ? "pass" : "FAIL"} | ${row.detail.replace(/\|/g, "/")} |`,
    ),
  ].join("\n");
}

function markdown(): string {
  const golden = runEvals(EVAL_CASES);
  const held = runEvals(HELD_OUT_CASES);
  const remaining = held.failed;
  const lines = [
    "# PayPilot parser evals",
    "",
    `Golden set: **${golden.passed}/${golden.total}**. Held-out: **${held.passed}/${held.total}** (baseline **${HELD_OUT_BASELINE.passed}/${HELD_OUT_BASELINE.total}** before parser changes).`,
    "",
    "These cases score deterministic parsers and policy (`parseChatAmount` + `evaluateProposal`). The chat model still drafts invoices; it cannot create or send PayPal invoices. Arithmetic stays in code.",
    "",
    "## How this was measured",
    "",
    "1. Wrote 15 held-out cases against the intended policy (last revised amount, refuse mixed currencies / euros / two emails, skip ISO date years, prefer marked amounts).",
    "2. Ran them against the old first-amount parser **without tuning**. Baseline: **6/15**.",
    "3. Applied general parser rules (not per-utterance). Golden `amt-inr-cut-to-last` (was `amt-inr-first-amount`) now expects ₹40,000 because `cut to` is a revision cue.",
    "",
    "## Baseline held-out failures (before)",
    "",
    "| id | detail |",
    "| --- | --- |",
    ...HELD_OUT_BASELINE.failures.map((row) => `| ${row.id} | ${row.detail} |`),
    "",
    "Root cause for all nine: `parseChatAmount` took the first regex number. That turned `2026-11-01` into $2,026, `2 weeks` into $2, `480 euros` into USD, and ignored later agreed/meant/cut-to amounts.",
    "",
    "## After general parser rules",
    "",
    `Held-out **${held.passed}/${held.total}**.`,
    "",
    remaining.length === 0
      ? "No remaining held-out failures."
      : [
          "Remaining failures (honest; `npm run eval` still exits 0 if golden is green):",
          "",
          "| id | detail |",
          "| --- | --- |",
          ...remaining.map((row) => `| ${row.id} | ${row.detail.replace(/\|/g, "/")} |`),
        ].join("\n"),
    "",
    "## Golden set (40)",
    "",
    table(golden.results),
    "",
    golden.failed.length === 0 ? "All golden cases passed." : `${golden.failed.length} golden failure(s).`,
    "",
    "## Held-out set (15)",
    "",
    table(held.results),
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

const golden = runEvals(EVAL_CASES);
const held = runEvals(HELD_OUT_CASES);
if (EVAL_CASES.length !== 40) {
  console.error(`Expected 40 golden eval cases, found ${EVAL_CASES.length}.`);
  process.exit(1);
}
if (HELD_OUT_CASES.length !== 15) {
  console.error(`Expected 15 held-out cases, found ${HELD_OUT_CASES.length}.`);
  process.exit(1);
}
if (golden.passed !== golden.total) {
  console.error(`Golden evals failed: ${golden.passed}/${golden.total}.`);
  process.exit(1);
}
process.stdout.write(`\nHeld-out ${held.passed}/${held.total} (does not fail the script).\n`);
