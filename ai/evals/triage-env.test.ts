import { describe, expect, it } from "vitest";

import { assertLiveTriageEvalEnvironment } from "./triage-env";

describe("triage eval environment", () => {
  it("requires Vercel OIDC for live triage evals", () => {
    expect(() =>
      assertLiveTriageEvalEnvironment({
        TRIAGE_EVAL_MODE: undefined,
        VERCEL_OIDC_TOKEN: undefined,
      })
    ).toThrow(/VERCEL_OIDC_TOKEN/);
  });

  it("allows fixture mode without Vercel OIDC", () => {
    expect(() =>
      assertLiveTriageEvalEnvironment({
        TRIAGE_EVAL_MODE: "expected",
        VERCEL_OIDC_TOKEN: undefined,
      })
    ).not.toThrow();
  });

  it("allows live mode when Vercel OIDC is present", () => {
    expect(() =>
      assertLiveTriageEvalEnvironment({
        TRIAGE_EVAL_MODE: undefined,
        VERCEL_OIDC_TOKEN: "test-token",
      })
    ).not.toThrow();
  });
});
