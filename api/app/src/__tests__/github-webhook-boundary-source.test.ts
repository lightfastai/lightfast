import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("GitHub webhook request boundary", () => {
  it("keeps request parsing and signature verification in the internal adapter", () => {
    const adapterSource = readFileSync(
      resolve(apiRoot, "adapters/internal/github-webhook.ts"),
      "utf8"
    );
    const serviceSource = readFileSync(
      resolve(apiRoot, "services/github/webhook/handler.ts"),
      "utf8"
    );
    const serviceIndexSource = readFileSync(
      resolve(apiRoot, "services/github/index.ts"),
      "utf8"
    );

    expect(adapterSource).toContain("GITHUB_APP_WEBHOOK_SECRET");
    expect(adapterSource).toContain("verifyGitHubWebhookSignature");
    expect(adapterSource).toContain("githubWebhookHeadersSchema");
    expect(adapterSource).toContain("request.text()");
    expect(adapterSource).toContain("handleVerifiedGitHubWebhook");
    expect(adapterSource).toContain('../../services/github/webhook/handler"');
    expect(adapterSource).not.toContain('../../services/github"');

    expect(serviceSource).toContain("handleVerifiedGitHubWebhook");
    expect(serviceSource).not.toContain("request: Request");
    expect(serviceSource).not.toContain("Promise<Response>");
    expect(serviceSource).not.toContain("Response.json");
    expect(serviceSource).not.toContain("new Response");
    expect(serviceSource).not.toContain("env");
    expect(serviceSource).not.toContain("verifyGitHubWebhookSignature");
    expect(serviceSource).not.toContain("x-hub-signature-256");
    expect(serviceSource).not.toContain("input.request");

    expect(serviceIndexSource).not.toContain("handleVerifiedGitHubWebhook");
  });
});
