import { describe, it, expect } from "vitest";
import { computeHmacSha256 } from "../../lib/crypto";
import { LinearProvider } from "./linear";

const provider = new LinearProvider();
const secret = "test-linear-secret";

function headers(map: Record<string, string>): Headers {
  return new Headers(map);
}

describe("LinearProvider", () => {
  describe("verifyWebhook", () => {
    it("accepts a valid signature", async () => {
      const body = '{"type":"Issue","action":"create"}';
      const sig = await computeHmacSha256(body, secret);

      const result = await provider.verifyWebhook(
        body,
        headers({ "linear-signature": sig }),
        secret,
      );
      expect(result).toBe(true);
    });

    it("rejects an invalid signature", async () => {
      const result = await provider.verifyWebhook(
        '{"type":"Issue","action":"create"}',
        headers({ "linear-signature": "badsig" }),
        secret,
      );
      expect(result).toBe(false);
    });

    it("rejects when signature header missing", async () => {
      const result = await provider.verifyWebhook(
        '{"type":"Issue"}',
        headers({}),
        secret,
      );
      expect(result).toBe(false);
    });
  });

  describe("parsePayload", () => {
    it("parses valid payload", () => {
      const raw = {
        type: "Issue",
        action: "create",
        organizationId: "org-123",
      };
      const result = provider.parsePayload(raw);
      expect(result.type).toBe("Issue");
      expect(result.action).toBe("create");
      expect(result.organizationId).toBe("org-123");
    });

    it("throws on non-object input", () => {
      expect(() => provider.parsePayload(null)).toThrow();
    });
  });

  describe("extractDeliveryId", () => {
    it("reads linear-delivery header", () => {
      const id = provider.extractDeliveryId(
        headers({ "linear-delivery": "del-789" }),
        {},
      );
      expect(id).toBe("del-789");
    });

    it("generates UUID when header missing", () => {
      const id = provider.extractDeliveryId(headers({}), {});
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe("extractEventType", () => {
    it("combines type and action", () => {
      const type = provider.extractEventType(headers({}), {
        type: "Issue",
        action: "create",
      });
      expect(type).toBe("Issue:create");
    });

    it("returns type alone when action missing", () => {
      const type = provider.extractEventType(headers({}), { type: "Issue" });
      expect(type).toBe("Issue");
    });

    it("returns 'unknown' when type missing", () => {
      const type = provider.extractEventType(headers({}), {});
      expect(type).toBe("unknown");
    });
  });

  describe("extractResourceId", () => {
    it("returns organizationId", () => {
      const id = provider.extractResourceId({ organizationId: "org-123" });
      expect(id).toBe("org-123");
    });

    it("returns null when organizationId missing", () => {
      const id = provider.extractResourceId({});
      expect(id).toBeNull();
    });
  });
});
