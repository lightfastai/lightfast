import { describe, it, expect } from "vitest";
import { computeHmacSha256 } from "../../lib/crypto";
import { GitHubProvider } from "./github";

const provider = new GitHubProvider();
const secret = "test-webhook-secret";

function headers(map: Record<string, string>): Headers {
  return new Headers(map);
}

describe("GitHubProvider", () => {
  describe("verifyWebhook", () => {
    it("accepts a valid sha256 signature", async () => {
      const body = '{"action":"opened"}';
      const sig = await computeHmacSha256(body, secret);

      const result = await provider.verifyWebhook(
        body,
        headers({ "x-hub-signature-256": `sha256=${sig}` }),
        secret,
      );
      expect(result).toBe(true);
    });

    it("rejects an invalid signature", async () => {
      const result = await provider.verifyWebhook(
        '{"action":"opened"}',
        headers({ "x-hub-signature-256": "sha256=deadbeef" }),
        secret,
      );
      expect(result).toBe(false);
    });

    it("rejects when signature header is missing", async () => {
      const result = await provider.verifyWebhook(
        '{"action":"opened"}',
        headers({}),
        secret,
      );
      expect(result).toBe(false);
    });

    it("accepts raw hex signature without sha256= prefix", async () => {
      // Some webhook relay tools strip the prefix
      const body = '{"action":"opened"}';
      const sig = await computeHmacSha256(body, secret);

      const result = await provider.verifyWebhook(
        body,
        headers({ "x-hub-signature-256": sig }),
        secret,
      );
      expect(result).toBe(true);
    });
  });

  describe("parsePayload", () => {
    it("parses valid payload with repository and installation", () => {
      const raw = { repository: { id: 123 }, installation: { id: 456 } };
      const result = provider.parsePayload(raw);
      expect(result.repository?.id).toBe(123);
      expect(result.installation?.id).toBe(456);
    });

    it("preserves extra fields via passthrough", () => {
      const raw = { repository: { id: 1 }, sender: { login: "user" } };
      const result = provider.parsePayload(raw);
      expect((result as Record<string, unknown>).sender).toEqual({
        login: "user",
      });
    });

    it("throws on non-object input", () => {
      expect(() => provider.parsePayload("not an object")).toThrow();
    });
  });

  describe("extractDeliveryId", () => {
    it("reads x-github-delivery header", () => {
      const id = provider.extractDeliveryId(
        headers({ "x-github-delivery": "abc-123" }),
        {},
      );
      expect(id).toBe("abc-123");
    });

    it("generates UUID when header missing", () => {
      const id = provider.extractDeliveryId(headers({}), {});
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe("extractEventType", () => {
    it("reads x-github-event header", () => {
      const type = provider.extractEventType(
        headers({ "x-github-event": "push" }),
        {},
      );
      expect(type).toBe("push");
    });

    it("returns 'unknown' when header missing", () => {
      const type = provider.extractEventType(headers({}), {});
      expect(type).toBe("unknown");
    });
  });

  describe("extractResourceId", () => {
    it("prefers repository.id", () => {
      const id = provider.extractResourceId({
        repository: { id: 42 },
        installation: { id: 99 },
      });
      expect(id).toBe("42");
    });

    it("falls back to installation.id", () => {
      const id = provider.extractResourceId({ installation: { id: 99 } });
      expect(id).toBe("99");
    });

    it("returns null when neither present", () => {
      const id = provider.extractResourceId({});
      expect(id).toBeNull();
    });

    it("handles falsy numeric ID 0", () => {
      // repo ID 0 is technically valid — must not be treated as "missing"
      const id = provider.extractResourceId({ repository: { id: 0 } });
      expect(id).toBe("0");
    });

    it("handles string IDs (some GitHub fields are strings)", () => {
      const id = provider.extractResourceId({
        repository: { id: "12345" },
      });
      expect(id).toBe("12345");
    });
  });

  describe("real-world payloads", () => {
    it("handles full GitHub push event payload", async () => {
      const pushPayload = {
        ref: "refs/heads/main",
        before: "abc123",
        after: "def456",
        repository: {
          id: 123456789,
          full_name: "lightfast/console",
          private: true,
          owner: { login: "lightfast", id: 1 },
        },
        installation: { id: 98765, node_id: "MDIzOk" },
        pusher: { name: "octocat", email: "octocat@github.com" },
        sender: { login: "octocat", id: 1, avatar_url: "https://..." },
        commits: [
          {
            id: "def456",
            message: "feat: add webhook gateway 🚀",
            author: { name: "Octocat", email: "octocat@github.com" },
            added: ["src/gateway.ts"],
            removed: [],
            modified: ["package.json"],
          },
        ],
        head_commit: { id: "def456", message: "feat: add webhook gateway 🚀" },
      };

      // Parse preserves all fields
      const parsed = provider.parsePayload(pushPayload);
      expect((parsed as Record<string, unknown>).ref).toBe("refs/heads/main");
      expect((parsed as Record<string, unknown>).commits).toHaveLength(1);

      // Extraction works on nested fields
      expect(provider.extractResourceId(parsed)).toBe("123456789");
    });

    it("handles GitHub ping event (no repository)", () => {
      const pingPayload = {
        zen: "Responsive is better than fast.",
        hook_id: 12345,
        hook: { type: "App", id: 1 },
        installation: { id: 98765 },
      };

      const parsed = provider.parsePayload(pingPayload);
      // Ping has no repository — falls back to installation.id
      expect(provider.extractResourceId(parsed)).toBe("98765");
    });

    it("handles GitHub installation event (no repository)", () => {
      const installPayload = {
        action: "created",
        installation: {
          id: 99999,
          account: { login: "my-org", id: 42 },
        },
        repositories: [{ id: 1, name: "repo-a" }],
      };

      const parsed = provider.parsePayload(installPayload);
      expect(provider.extractResourceId(parsed)).toBe("99999");
    });
  });
});
