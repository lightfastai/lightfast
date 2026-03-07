import { describe, it, expect } from "vitest";
import { PROVIDERS, getProvider } from "@repo/console-providers";

describe("PROVIDERS registry", () => {
  it("has github provider", () => {
    expect(PROVIDERS.github).toBeDefined();
    expect(PROVIDERS.github.name).toBe("github");
  });

  it("has vercel provider", () => {
    expect(PROVIDERS.vercel).toBeDefined();
    expect(PROVIDERS.vercel.name).toBe("vercel");
  });

  it("has linear provider", () => {
    expect(PROVIDERS.linear).toBeDefined();
    expect(PROVIDERS.linear.name).toBe("linear");
  });

  it("has sentry provider", () => {
    expect(PROVIDERS.sentry).toBeDefined();
    expect(PROVIDERS.sentry.name).toBe("sentry");
  });

  it("each provider has a webhook definition", () => {
    for (const [, provider] of Object.entries(PROVIDERS)) {
      expect(provider.webhook).toBeDefined();
      expect(typeof provider.webhook.verifySignature).toBe("function");
      expect(typeof provider.webhook.parsePayload).toBe("function");
      expect(typeof provider.webhook.extractDeliveryId).toBe("function");
      expect(typeof provider.webhook.extractEventType).toBe("function");
      expect(typeof provider.webhook.extractResourceId).toBe("function");
      expect(typeof provider.webhook.extractSecret).toBe("function");
    }
  });
});

describe("getProvider", () => {
  it("returns github provider", () => {
    expect(getProvider("github")).toBe(PROVIDERS.github);
  });

  it("returns vercel provider", () => {
    expect(getProvider("vercel")).toBe(PROVIDERS.vercel);
  });

  it("returns linear provider", () => {
    expect(getProvider("linear")).toBe(PROVIDERS.linear);
  });

  it("returns sentry provider", () => {
    expect(getProvider("sentry")).toBe(PROVIDERS.sentry);
  });

  it("returns undefined for unknown provider", () => {
    expect(getProvider("unknown")).toBeUndefined();
  });
});
