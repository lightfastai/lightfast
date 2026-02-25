import { describe, it, expect } from "vitest";
import { computeHmacSha1 } from "../../lib/crypto";
import { VercelProvider } from "./vercel";

const provider = new VercelProvider();
const secret = "test-vercel-secret";

function headers(map: Record<string, string>): Headers {
  return new Headers(map);
}

describe("VercelProvider", () => {
  describe("verifyWebhook", () => {
    it("accepts a valid sha1 signature", async () => {
      const body = '{"type":"deployment.created"}';
      const sig = await computeHmacSha1(body, secret);

      const result = await provider.verifyWebhook(
        body,
        headers({ "x-vercel-signature": sig }),
        secret,
      );
      expect(result).toBe(true);
    });

    it("rejects an invalid signature", async () => {
      const result = await provider.verifyWebhook(
        '{"type":"deployment.created"}',
        headers({ "x-vercel-signature": "badsig" }),
        secret,
      );
      expect(result).toBe(false);
    });

    it("rejects when signature header missing", async () => {
      const result = await provider.verifyWebhook(
        '{"type":"deployment.created"}',
        headers({}),
        secret,
      );
      expect(result).toBe(false);
    });
  });

  describe("parsePayload", () => {
    it("parses valid payload with nested project", () => {
      const raw = {
        id: "evt_1",
        type: "deployment.created",
        payload: { project: { id: "prj_1" }, team: { id: "team_1" } },
      };
      const result = provider.parsePayload(raw);
      expect(result.type).toBe("deployment.created");
      expect(result.payload?.project?.id).toBe("prj_1");
    });

    it("throws on non-object input", () => {
      expect(() => provider.parsePayload(42)).toThrow();
    });
  });

  describe("extractDeliveryId", () => {
    it("prefers payload.id over header", () => {
      const id = provider.extractDeliveryId(
        headers({ "x-vercel-id": "hdr-123" }),
        { id: "body-456" },
      );
      expect(id).toBe("body-456");
    });

    it("falls back to x-vercel-id header", () => {
      const id = provider.extractDeliveryId(
        headers({ "x-vercel-id": "hdr-123" }),
        {},
      );
      expect(id).toBe("hdr-123");
    });

    it("generates UUID when both missing", () => {
      const id = provider.extractDeliveryId(headers({}), {});
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe("extractEventType", () => {
    it("reads type from payload", () => {
      const type = provider.extractEventType(headers({}), {
        type: "deployment.ready",
      });
      expect(type).toBe("deployment.ready");
    });

    it("returns 'unknown' when type missing", () => {
      const type = provider.extractEventType(headers({}), {});
      expect(type).toBe("unknown");
    });
  });

  describe("extractResourceId", () => {
    it("prefers payload.project.id", () => {
      const id = provider.extractResourceId({
        payload: { project: { id: "prj_1" }, team: { id: "team_1" } },
      });
      expect(id).toBe("prj_1");
    });

    it("falls back to payload.team.id", () => {
      const id = provider.extractResourceId({
        payload: { team: { id: "team_1" } },
      });
      expect(id).toBe("team_1");
    });

    it("returns null when neither present", () => {
      const id = provider.extractResourceId({});
      expect(id).toBeNull();
    });
  });
});
