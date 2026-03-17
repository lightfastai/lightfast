/**
 * Unit tests for the GitHub provider — OAuth, webhook, and getActiveToken.
 *
 * fetch is stubbed globally for the file; each test configures
 * mockFetch as needed and the mock is reset after each test.
 *
 * A real 2048-bit RSA PKCS8 key is generated once in beforeAll
 * so JWT-creation paths exercise actual Web Crypto, not just mocks.
 */

import { generateKeyPairSync } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { computeHmac } from "../../crypto";
import type { GitHubConfig } from "./auth";
import { github } from "./index";

// ── Global fetch mock ──────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeAll(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  mockFetch.mockReset();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

// ── RSA key + test config (generated once) ─────────────────────────────────────

let testConfig: GitHubConfig;

beforeAll(() => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  testConfig = {
    appSlug: "test-app",
    appId: "123456",
    privateKey,
    clientId: "Iv1.abc123",
    clientSecret: "secret123",
    webhookSecret: "webhook-secret",
  };
});

// ── Fixtures ───────────────────────────────────────────────────────────────────

// ── oauth.buildAuthUrl ─────────────────────────────────────────────────────────

describe("oauth.buildAuthUrl", () => {
  it("builds correct GitHub App installation URL with appSlug", () => {
    const config: GitHubConfig = { ...testConfig, appSlug: "my-github-app" };
    const url = github.auth.buildAuthUrl(config, "state-abc");
    expect(url).toContain(
      "https://github.com/apps/my-github-app/installations/new"
    );
  });

  it("embeds state as a query parameter", () => {
    const url = github.auth.buildAuthUrl(testConfig, "my-state-value");
    expect(url).toContain("state=my-state-value");
  });

  it("returns a string", () => {
    expect(typeof github.auth.buildAuthUrl(testConfig, "s")).toBe("string");
  });
});

// ── oauth.exchangeCode ────────────────────────────────────────────────────────

describe("oauth.exchangeCode", () => {
  it("returns OAuthTokens with accessToken, tokenType, and scope on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "ghu_token123",
          token_type: "bearer",
          scope: "repo,user",
        }),
    });

    const tokens = await github.auth.exchangeCode(
      testConfig,
      "code123",
      "https://app.example.com/callback"
    );
    expect(tokens.accessToken).toBe("ghu_token123");
    expect(tokens.tokenType).toBe("bearer");
    expect(tokens.scope).toBe("repo,user");
    expect(tokens.raw).toBeDefined();
  });

  it("throws when GitHub returns an OAuth error object", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          error: "bad_verification_code",
          error_description: "The code passed is incorrect or expired.",
          error_uri: "https://docs.github.com/",
        }),
    });

    await expect(
      github.auth.exchangeCode(
        testConfig,
        "bad-code",
        "https://app.example.com/callback"
      )
    ).rejects.toThrow("GitHub OAuth error");
  });

  it("throws on HTTP error status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(
      github.auth.exchangeCode(
        testConfig,
        "code",
        "https://app.example.com/callback"
      )
    ).rejects.toThrow("GitHub token exchange failed: 401");
  });

  it("sends POST with correct content-type and accept headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "ghu_x",
          token_type: "bearer",
          scope: "",
        }),
    });

    await github.auth.exchangeCode(
      testConfig,
      "code",
      "https://app.example.com/cb"
    );

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://github.com/login/oauth/access_token");
    expect((init.headers as Record<string, string>).Accept).toBe(
      "application/json"
    );
    expect(init.method).toBe("POST");
  });
});

// ── oauth.refreshToken ────────────────────────────────────────────────────────

describe("oauth.refreshToken", () => {
  it("always rejects — GitHub user tokens do not support refresh", async () => {
    await expect(
      github.auth.refreshToken(testConfig, "any-refresh-token")
    ).rejects.toThrow("do not support refresh");
  });

  it("does not call fetch", async () => {
    await github.auth.refreshToken(testConfig, "t").catch(vi.fn());
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── oauth.revokeToken ─────────────────────────────────────────────────────────

describe("oauth.revokeToken", () => {
  it("calls DELETE to the GitHub token endpoint", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await expect(
      github.auth.revokeToken(testConfig, "ghu_token123")
    ).resolves.toBeUndefined();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(testConfig.clientId);
    expect(init.method).toBe("DELETE");
  });

  it("uses Basic auth with clientId:clientSecret", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await github.auth.revokeToken(testConfig, "ghu_token");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const authHeader =
      (init.headers as Record<string, string>).Authorization ?? "";
    expect(authHeader).toMatch(/^Basic /);
    const decoded = atob(authHeader.replace("Basic ", ""));
    expect(decoded).toBe(`${testConfig.clientId}:${testConfig.clientSecret}`);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422 });

    await expect(
      github.auth.revokeToken(testConfig, "bad-token")
    ).rejects.toThrow("GitHub token revocation failed: 422");
  });
});

// ── oauth.processCallback ─────────────────────────────────────────────────────

describe("oauth.processCallback", () => {
  it("throws for setup_action=request — not yet implemented", async () => {
    await expect(
      github.auth.processCallback(testConfig, {
        installation_id: "12345",
        setup_action: "request",
      })
    ).rejects.toThrow("setup_action=request is not yet implemented");
  });

  it("throws for setup_action=update — not yet implemented", async () => {
    await expect(
      github.auth.processCallback(testConfig, {
        installation_id: "12345",
        setup_action: "update",
      })
    ).rejects.toThrow("setup_action=update is not yet implemented");
  });

  it("throws when installation_id is missing", async () => {
    await expect(github.auth.processCallback(testConfig, {})).rejects.toThrow(
      "missing installation_id"
    );
  });

  it("returns valid CallbackResult with connected-no-token status on happy path", async () => {
    const result = await github.auth.processCallback(testConfig, {
      installation_id: "12345",
    });

    expect(result.status).toBe("connected-no-token");
    expect(result.externalId).toBe("12345");
    if (result.status === "connected-no-token") {
      expect(result.accountInfo.version).toBe(1);
      expect(result.accountInfo.sourceType).toBe("github");
    }
  });

  it("accountInfo has hardcoded events and empty raw (display data resolved live)", async () => {
    const result = await github.auth.processCallback(testConfig, {
      installation_id: "12345",
    });
    if (result.status === "connected-no-token") {
      expect(result.accountInfo.events).toContain("pull_request");
      expect(result.accountInfo.events).toContain("issues");
      expect(result.accountInfo.events).not.toContain("push");
      // raw is empty — display data (account login, avatar) is resolved live
      expect(result.accountInfo.raw).toEqual({});
    }
  });

  it("returns connected-no-token even with setup_action=install", async () => {
    const result = await github.auth.processCallback(testConfig, {
      installation_id: "12345",
      setup_action: "install",
    });
    expect(result.status).toBe("connected-no-token");
  });
});

// ── webhook.verifySignature ───────────────────────────────────────────────────

describe("webhook.verifySignature", () => {
  const secret = "webhook-secret";
  const body = '{"action":"push","ref":"refs/heads/main"}';

  it("returns false when x-hub-signature-256 header is absent", () => {
    const result = github.webhook.verifySignature(body, new Headers(), secret);
    expect(result).toBe(false);
  });

  it("returns false for an incorrect signature", () => {
    const headers = new Headers({ "x-hub-signature-256": "sha256=000000" });
    const result = github.webhook.verifySignature(body, headers, secret);
    expect(result).toBe(false);
  });

  it("returns true for a valid signature with sha256= prefix", () => {
    const expected = computeHmac(body, secret, "SHA-256");
    const headers = new Headers({
      "x-hub-signature-256": `sha256=${expected}`,
    });
    const result = github.webhook.verifySignature(body, headers, secret);
    expect(result).toBe(true);
  });

  it("returns true for a valid signature without sha256= prefix", () => {
    const expected = computeHmac(body, secret, "SHA-256");
    const headers = new Headers({ "x-hub-signature-256": expected });
    const result = github.webhook.verifySignature(body, headers, secret);
    expect(result).toBe(true);
  });

  it("returns false for signature computed with wrong secret", () => {
    const wrongSig = computeHmac(body, "wrong-secret", "SHA-256");
    const headers = new Headers({
      "x-hub-signature-256": `sha256=${wrongSig}`,
    });
    const result = github.webhook.verifySignature(body, headers, secret);
    expect(result).toBe(false);
  });
});

// ── webhook.extractEventType ──────────────────────────────────────────────────

describe("webhook.extractEventType", () => {
  it("returns the x-github-event header value", () => {
    const headers = new Headers({ "x-github-event": "push" });
    expect(github.webhook.extractEventType(headers, {})).toBe("push");
  });

  it("returns 'unknown' when header is absent", () => {
    expect(github.webhook.extractEventType(new Headers(), {})).toBe("unknown");
  });

  it("handles pull_request event type", () => {
    const headers = new Headers({ "x-github-event": "pull_request" });
    expect(github.webhook.extractEventType(headers, {})).toBe("pull_request");
  });
});

// ── webhook.extractDeliveryId ─────────────────────────────────────────────────

describe("webhook.extractDeliveryId", () => {
  it("returns x-github-delivery header value", () => {
    const headers = new Headers({ "x-github-delivery": "abc-delivery-123" });
    expect(github.webhook.extractDeliveryId(headers, {})).toBe(
      "abc-delivery-123"
    );
  });

  it("returns a UUID-shaped string when header is absent", () => {
    const id = github.webhook.extractDeliveryId(new Headers(), {});
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

// ── webhook.extractResourceId ─────────────────────────────────────────────────

describe("webhook.extractResourceId", () => {
  it("returns repository.id as string when present", () => {
    const payload = { repository: { id: 12_345 } };
    expect(github.webhook.extractResourceId(payload)).toBe("12345");
  });

  it("returns installation.id when repository is absent", () => {
    const payload = { installation: { id: 67_890 } };
    expect(github.webhook.extractResourceId(payload)).toBe("67890");
  });

  it("prefers repository.id over installation.id", () => {
    const payload = { repository: { id: 100 }, installation: { id: 200 } };
    expect(github.webhook.extractResourceId(payload)).toBe("100");
  });

  it("returns null when neither repository nor installation present", () => {
    expect(github.webhook.extractResourceId({})).toBeNull();
  });

  it("returns null when repository.id is null/undefined", () => {
    const payload = { repository: { id: null } };
    expect(github.webhook.extractResourceId(payload)).toBeNull();
  });
});

// ── oauth.getActiveToken ──────────────────────────────────────────────────────

describe("oauth.getActiveToken", () => {
  it("throws for non-numeric installationId", async () => {
    await expect(
      github.auth.getActiveToken(testConfig, "not-a-number", null)
    ).rejects.toThrow("Invalid GitHub installation ID: must be numeric");
  });

  it("returns token string on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: "ghs_installation_token_abc" }),
    });

    const token = await github.auth.getActiveToken(testConfig, "12345", null);
    expect(token).toBe("ghs_installation_token_abc");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(
      github.auth.getActiveToken(testConfig, "12345", null)
    ).rejects.toThrow("GitHub installation token request failed: 404");
  });

  it("throws when response is missing a valid token field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ not_token: "nope" }),
    });

    await expect(
      github.auth.getActiveToken(testConfig, "12345", null)
    ).rejects.toThrow("GitHub installation token response missing valid token");
  });

  it("uses correct GitHub API endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: "ghs_x" }),
    });

    await github.auth.getActiveToken(testConfig, "99999", null);

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain(
      "https://api.github.com/app/installations/99999/access_tokens"
    );
  });
});

// ── webhook.parsePayload ──────────────────────────────────────────────────────

describe("webhook.parsePayload", () => {
  it("accepts any object payload (loose schema)", () => {
    const raw = { action: "push", repository: { id: 1 }, arbitrary: "field" };
    expect(() => github.webhook.parsePayload(raw)).not.toThrow();
  });
});

// ── extractSecret ─────────────────────────────────────────────────────────────

describe("webhook.extractSecret", () => {
  it("returns config.webhookSecret", () => {
    expect(github.webhook.extractSecret(testConfig)).toBe("webhook-secret");
  });
});
