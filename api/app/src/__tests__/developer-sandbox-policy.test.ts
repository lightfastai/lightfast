import { describe, expect, it } from "vitest";
import {
  evaluateDeveloperSandboxCommandPolicy,
  normalizeCommandTextForPolicy,
} from "../services/developer-sandbox-runs/policy";
import { redactText } from "../services/developer-sandbox-runs/redaction";

describe("developer sandbox command policy", () => {
  it("blocks direct provider auth login and logout commands", () => {
    expect(
      evaluateDeveloperSandboxCommandPolicy({
        cmd: "pscale",
        args: ["auth", "login"],
      }),
    ).toEqual({
      allowed: false,
      reason: "PlanetScale auth login is managed by Lightfast.",
      ruleId: "lightfast_default.pscale.auth_login",
    });

    expect(
      evaluateDeveloperSandboxCommandPolicy({
        cmd: "upstash",
        args: ["auth", "logout"],
      }),
    ).toEqual({
      allowed: false,
      reason: "Upstash auth logout is managed by Lightfast.",
      ruleId: "lightfast_default.upstash.auth_logout",
    });
  });

  it("blocks obvious auth commands inside shell text", () => {
    expect(
      normalizeCommandTextForPolicy({
        cmd: "bash",
        args: ["-lc", "pnpm test;\nclerk auth login"],
      }),
    ).toContain("clerk auth login");

    expect(
      evaluateDeveloperSandboxCommandPolicy({
        cmd: "bash",
        args: ["-lc", "echo ok && npx --yes sentry auth logout"],
      }),
    ).toEqual({
      allowed: false,
      reason: "Sentry auth logout is managed by Lightfast.",
      ruleId: "lightfast_default.sentry.auth_logout",
    });
  });

  it("allows ordinary direct and shell commands", () => {
    expect(
      evaluateDeveloperSandboxCommandPolicy({
        cmd: "pscale",
        args: ["branch", "list", "lightfast"],
      }),
    ).toEqual({ allowed: true });

    expect(
      evaluateDeveloperSandboxCommandPolicy({
        cmd: "bash",
        args: ["-lc", "npx --yes clerk --help && echo done"],
      }),
    ).toEqual({ allowed: true });
  });
});

describe("developer sandbox output redaction", () => {
  it("redacts configured secrets and counts replacements", () => {
    expect(
      redactText("token-secret token-secret sentry-token", [
        "token-secret",
        "sentry-token",
      ]),
    ).toEqual({
      redactionCount: 3,
      text: "[redacted] [redacted] [redacted]",
    });
  });

  it("ignores empty and very short secret values", () => {
    expect(redactText("abc token-secret", ["", "abc", "token-secret"])).toEqual(
      {
        redactionCount: 1,
        text: "abc [redacted]",
      },
    );
  });
});
