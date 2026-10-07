import { describe, expect, it } from "vitest";
import { EVAL_CASES, HELD_OUT_CASES, runEvals } from "@/lib/agent/evals";

describe("parser evals", () => {
  it("has 40 golden cases and all of them pass", () => {
    expect(EVAL_CASES).toHaveLength(40);
    const result = runEvals(EVAL_CASES);
    expect(result.failed).toEqual([]);
    expect(result.passed).toBe(40);
  });

  it("has 15 held-out cases and does not require a perfect score", () => {
    expect(HELD_OUT_CASES).toHaveLength(15);
    const ids = new Set(HELD_OUT_CASES.map((row) => row.id));
    expect(ids.size).toBe(15);
    const result = runEvals(HELD_OUT_CASES);
    expect(result.total).toBe(15);
  });
});
