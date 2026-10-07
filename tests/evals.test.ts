import { describe, expect, it } from "vitest";
import { EVAL_CASES, runEvals } from "@/lib/agent/evals";

describe("parser evals", () => {
  it("has 40 cases and all of them pass", () => {
    expect(EVAL_CASES).toHaveLength(40);
    const result = runEvals();
    expect(result.failed).toEqual([]);
    expect(result.passed).toBe(40);
  });
});
