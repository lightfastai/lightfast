import { describe, it, expect } from "vitest";
import { computeHmacSha256 } from "../../lib/crypto";
import { SentryProvider } from "./sentry";

const provider = new SentryProvider();
const secret = "test-sentry-secret";

function headers(map: Record<string, string>): Headers {
  return new Headers(map);
}

describe("SentryProvider", () => {
  describe("verifyWebhook", () => {
    it("accepts a valid signature", async () => {
      const body = '{"installation":{"uuid":"inst-1"}}';
      const sig = await computeHmacSha256(body, secret);

      const result = await provider.verifyWebhook(
        body,
        headers({ "sentry-hook-signature": sig }),
        secret,
      );
      expect(result).toBe(true);
    });

    it("rejects an invalid signature", async () => {
      const result = await provider.verifyWebhook(
        '{"installation":{"uuid":"inst-1"}}',
        headers({ "sentry-hook-signature": "badsig" }),
        secret,
      );
      expect(result).toBe(false);
    });

    it("rejects when signature header missing", async () => {
      const result = await provider.verifyWebhook(
        '{"installation":{"uuid":"inst-1"}}',
        headers({}),
        secret,
      );
      expect(result).toBe(false);
    });
  });

  describe("parsePayload", () => {
    it("parses valid payload with installation", () => {
      const raw = { installation: { uuid: "inst-1" } };
      const result = provider.parsePayload(raw);
      expect(result.installation?.uuid).toBe("inst-1");
    });

    it("throws on non-object input", () => {
      expect(() => provider.parsePayload("bad")).toThrow();
    });
  });

  describe("extractDeliveryId", () => {
    it("combines resource and timestamp headers", () => {
      const id = provider.extractDeliveryId(
        headers({
          "sentry-hook-resource": "issue",
          "sentry-hook-timestamp": "1700000000",
        }),
        {},
      );
      expect(id).toBe("issue:1700000000");
    });

    it("generates UUID when headers missing", () => {
      const id = provider.extractDeliveryId(headers({}), {});
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe("extractEventType", () => {
    it("reads sentry-hook-resource header", () => {
      const type = provider.extractEventType(
        headers({ "sentry-hook-resource": "issue" }),
        {},
      );
      expect(type).toBe("issue");
    });

    it("returns 'unknown' when header missing", () => {
      const type = provider.extractEventType(headers({}), {});
      expect(type).toBe("unknown");
    });
  });

  describe("extractResourceId", () => {
    it("returns installation.uuid", () => {
      const id = provider.extractResourceId({
        installation: { uuid: "inst-1" },
      });
      expect(id).toBe("inst-1");
    });

    it("returns null when installation missing", () => {
      const id = provider.extractResourceId({});
      expect(id).toBeNull();
    });
  });
});
