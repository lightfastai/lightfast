import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGitHubWebhookSignature } from "../webhooks";

function signature(secret: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("GitHub webhook signature verification", () => {
  it("accepts a valid sha256 signature", () => {
    const body = JSON.stringify({ ref: "refs/heads/main" });
    expect(
      verifyGitHubWebhookSignature({
        body,
        secret: "secret",
        signature256: signature("secret", body),
      })
    ).toBe(true);
  });

  it("rejects missing, malformed, and mismatched signatures", () => {
    const body = JSON.stringify({ ref: "refs/heads/main" });
    const validSignature = signature("secret", body);
    expect(
      verifyGitHubWebhookSignature({
        body,
        secret: "secret",
        signature256: "",
      })
    ).toBe(false);
    expect(
      verifyGitHubWebhookSignature({
        body,
        secret: "secret",
        signature256: "sha1=abc",
      })
    ).toBe(false);
    expect(
      verifyGitHubWebhookSignature({
        body,
        secret: "secret",
        signature256: `${validSignature}zz`,
      })
    ).toBe(false);
    expect(
      verifyGitHubWebhookSignature({
        body,
        secret: "secret",
        signature256: signature("wrong", body),
      })
    ).toBe(false);
  });
});
