import { describe, it, expect } from "vitest";
import { PROVIDERS, computeHmac } from "@repo/console-providers";

const provider = PROVIDERS.linear.webhook;
const secret = "test-linear-secret";

function headers(map: Record<string, string>): Headers {
  return new Headers(map);
}

describe("linear webhook provider", () => {
  describe("verifySignature", () => {
    it("accepts a valid signature", async () => {
      const body = '{"type":"Issue","action":"create"}';
      const sig = await computeHmac(body, secret, "SHA-256");

      const result = await provider.verifySignature(
        body,
        headers({ "linear-signature": sig }),
        secret,
      );
      expect(result).toBe(true);
    });

    it("rejects an invalid signature", async () => {
      const result = await provider.verifySignature(
        '{"type":"Issue","action":"create"}',
        headers({ "linear-signature": "badsig" }),
        secret,
      );
      expect(result).toBe(false);
    });

    it("rejects when signature header missing", async () => {
      const result = await provider.verifySignature(
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
      const result = provider.parsePayload(raw) as Record<string, unknown>;
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

    it("generates deterministic fallback when header missing", () => {
      const payload = { type: "Issue", action: "create", organizationId: "org-1" };
      const id1 = provider.extractDeliveryId(headers({}), payload);
      const id2 = provider.extractDeliveryId(headers({}), payload);
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{32}$/);
    });

    it("produces different IDs for different payloads", () => {
      const id1 = provider.extractDeliveryId(headers({}), { type: "Issue", action: "create" });
      const id2 = provider.extractDeliveryId(headers({}), { type: "Issue", action: "update" });
      expect(id1).not.toBe(id2);
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
