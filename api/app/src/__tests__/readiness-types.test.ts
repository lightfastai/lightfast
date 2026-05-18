import { describe, expect, it } from "vitest";

import { deriveReadiness } from "../auth/readiness/types";

describe("deriveReadiness", () => {
  it("treats empty cleared set against any required keys as fully pending", () => {
    expect(deriveReadiness(["a", "b"], new Set())).toEqual({
      type: "pending",
      current: "a",
      remaining: ["a", "b"],
    });
  });

  it("treats all required keys cleared as fully cleared", () => {
    expect(deriveReadiness(["a", "b"], new Set(["a", "b"]))).toEqual({
      type: "cleared",
    });
  });

  it("ignores cleared keys not in the required set (forwards-compat)", () => {
    expect(deriveReadiness(["a"], new Set(["a", "extra"]))).toEqual({
      type: "cleared",
    });
  });

  it("orders remaining by the required-keys argument", () => {
    expect(deriveReadiness(["a", "b", "c"], new Set(["b"]))).toEqual({
      type: "pending",
      current: "a",
      remaining: ["a", "c"],
    });
  });

  it("treats empty required-keys list as cleared regardless of cleared set", () => {
    expect(deriveReadiness([], new Set())).toEqual({ type: "cleared" });
    expect(deriveReadiness([], new Set(["x"]))).toEqual({ type: "cleared" });
  });
});
