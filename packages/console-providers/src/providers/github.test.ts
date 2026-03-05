/**
 * Unit tests for the GitHub provider — OAuth, webhook, and capabilities.
 *
 * fetch is stubbed globally for the file; each test configures
 * mockFetch as needed and the mock is reset after each test.
 *
 * A real 2048-bit RSA PKCS8 key is generated once in beforeAll
 * so JWT-creation paths exercise actual Web Crypto, not just mocks.
 */
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { github } from "./github";
import { computeHmac } from "../crypto";
import type { GitHubConfig } from "../types";

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

const mockInstallationResponse = {
  account: {
    login: "my-org",
    id: 42,
    type: "Organization",
    avatar_url: "https://avatars.githubusercontent.com/u/42",
  },
  permissions: { contents: "read", metadata: "read" },
  events: ["push", "pull_request"],
  created_at: "2024-01-01T00:00:00Z",
};

// ── oauth.buildAuthUrl ─────────────────────────────────────────────────────────

describe("oauth.buildAuthUrl", () => {
  it("builds correct GitHub App installation URL with appSlug", () => {
    const config: GitHubConfig = { ...testConfig, appSlug: "my-github-app" };
    const url = github.oauth.buildAuthUrl(config, "state-abc");
    expect(url).toContain("https://github.com/apps/my-github-app/installations/new");
  });

  it("embeds state as a query parameter", () => {
    const url = github.oauth.buildAuthUrl(testConfig, "my-state-value");
    expect(url).toContain("state=my-state-value");
  });

  it("returns a string", () => {
    expect(typeof github.oauth.buildAuthUrl(testConfig, "s")).toBe("string");
  });
});

// ── oauth.exchangeCode ────────────────────────────────────────────────────────

describe("oauth.exchangeCode", () => {
  it("returns OAuthTokens with accessToken, tokenType, and scope on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "ghu_token123",
        token_type: "bearer",
        scope: "repo,user",
      }),
    });

    const tokens = await github.oauth.exchangeCode(testConfig, "code123", "https://app.example.com/callback");
    expect(tokens.accessToken).toBe("ghu_token123");
    expect(tokens.tokenType).toBe("bearer");
    expect(tokens.scope).toBe("repo,user");
    expect(tokens.raw).toBeDefined();
  });

  it("throws when GitHub returns an OAuth error object", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        error: "bad_verification_code",
        error_description: "The code passed is incorrect or expired.",
        error_uri: "https://docs.github.com/",
      }),
    });

    await expect(
      github.oauth.exchangeCode(testConfig, "bad-code", "https://app.example.com/callback"),
    ).rejects.toThrow("GitHub OAuth error");
  });

  it("throws on HTTP error status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(
      github.oauth.exchangeCode(testConfig, "code", "https://app.example.com/callback"),
    ).rejects.toThrow("GitHub token exchange failed: 401");
  });

  it("sends POST with correct content-type and accept headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "ghu_x", token_type: "bearer", scope: "" }),
    });

    await github.oauth.exchangeCode(testConfig, "code", "https://app.example.com/cb");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://github.com/login/oauth/access_token");
    expect((init.headers as Record<string, string>)["Accept"]).toBe("application/json");
    expect(init.method).toBe("POST");
  });
});

// ── oauth.refreshToken ────────────────────────────────────────────────────────

describe("oauth.refreshToken", () => {
  it("always rejects — GitHub user tokens do not support refresh", async () => {
    await expect(github.oauth.refreshToken(testConfig, "any-refresh-token")).rejects.toThrow(
      "do not support refresh",
    );
  });

  it("does not call fetch", async () => {
    await github.oauth.refreshToken(testConfig, "t").catch(() => {});
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── oauth.revokeToken ─────────────────────────────────────────────────────────

describe("oauth.revokeToken", () => {
  it("calls DELETE to the GitHub token endpoint", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await expect(github.oauth.revokeToken(testConfig, "ghu_token123")).resolves.toBeUndefined();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(testConfig.clientId);
    expect(init.method).toBe("DELETE");
  });

  it("uses Basic auth with clientId:clientSecret", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await github.oauth.revokeToken(testConfig, "ghu_token");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const authHeader = (init.headers as Record<string, string>)["Authorization"];
    expect(authHeader).toMatch(/^Basic /);
    const decoded = atob(authHeader!.replace("Basic ", ""));
    expect(decoded).toBe(`${testConfig.clientId}:${testConfig.clientSecret}`);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422 });

    await expect(github.oauth.revokeToken(testConfig, "bad-token")).rejects.toThrow(
      "GitHub token revocation failed: 422",
    );
  });
});

// ── oauth.processCallback ─────────────────────────────────────────────────────

describe("oauth.processCallback", () => {
  it("throws for setup_action=request — not yet implemented", async () => {
    await expect(
      github.oauth.processCallback(testConfig, {
        installation_id: "12345",
        setup_action: "request",
      }),
    ).rejects.toThrow("setup_action=request is not yet implemented");
  });

  it("throws for setup_action=update — not yet implemented", async () => {
    await expect(
      github.oauth.processCallback(testConfig, {
        installation_id: "12345",
        setup_action: "update",
      }),
    ).rejects.toThrow("setup_action=update is not yet implemented");
  });

  it("throws when installation_id is missing", async () => {
    await expect(github.oauth.processCallback(testConfig, {})).rejects.toThrow(
      "missing installation_id",
    );
  });

  it("throws when installation_id is non-numeric", async () => {
    await expect(
      github.oauth.processCallback(testConfig, { installation_id: "not-a-number" }),
    ).rejects.toThrow("Invalid GitHub installation ID");
  });

  it("returns valid CallbackResult on happy path (install)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockInstallationResponse,
    });

    const result = await github.oauth.processCallback(testConfig, {
      installation_id: "12345",
    });

    expect(result.externalId).toBe("12345");
    expect(result.accountInfo.version).toBe(1);
    expect(result.accountInfo.sourceType).toBe("github");
  });

  it("accountInfo contains events from installation details", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockInstallationResponse,
    });

    const result = await github.oauth.processCallback(testConfig, { installation_id: "12345" });
    const raw = result.accountInfo.raw as typeof mockInstallationResponse;
    expect(raw.events).toContain("push");
  });

  it("propagates setupAction=install as undefined (normal install)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockInstallationResponse,
    });

    const result = await github.oauth.processCallback(testConfig, {
      installation_id: "12345",
      setup_action: "install",
    });
    expect(result.setupAction).toBe("install");
  });
});

// ── webhook.verifySignature ───────────────────────────────────────────────────

describe("webhook.verifySignature", () => {
  const secret = "webhook-secret";
  const body = '{"action":"push","ref":"refs/heads/main"}';

  it("returns false when x-hub-signature-256 header is absent", async () => {
    const result = await github.webhook.verifySignature(body, new Headers(), secret);
    expect(result).toBe(false);
  });

  it("returns false for an incorrect signature", async () => {
    const headers = new Headers({ "x-hub-signature-256": "sha256=000000" });
    const result = await github.webhook.verifySignature(body, headers, secret);
    expect(result).toBe(false);
  });

  it("returns true for a valid signature with sha256= prefix", async () => {
    const expected = await computeHmac(body, secret, "SHA-256");
    const headers = new Headers({ "x-hub-signature-256": `sha256=${expected}` });
    const result = await github.webhook.verifySignature(body, headers, secret);
    expect(result).toBe(true);
  });

  it("returns true for a valid signature without sha256= prefix", async () => {
    const expected = await computeHmac(body, secret, "SHA-256");
    const headers = new Headers({ "x-hub-signature-256": expected });
    const result = await github.webhook.verifySignature(body, headers, secret);
    expect(result).toBe(true);
  });

  it("returns false for signature computed with wrong secret", async () => {
    const wrongSig = await computeHmac(body, "wrong-secret", "SHA-256");
    const headers = new Headers({ "x-hub-signature-256": `sha256=${wrongSig}` });
    const result = await github.webhook.verifySignature(body, headers, secret);
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
    expect(github.webhook.extractDeliveryId(headers, {})).toBe("abc-delivery-123");
  });

  it("returns a UUID-shaped string when header is absent", () => {
    const id = github.webhook.extractDeliveryId(new Headers(), {});
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

// ── webhook.extractResourceId ─────────────────────────────────────────────────

describe("webhook.extractResourceId", () => {
  it("returns repository.id as string when present", () => {
    const payload = { repository: { id: 12345 } };
    expect(github.webhook.extractResourceId(payload)).toBe("12345");
  });

  it("returns installation.id when repository is absent", () => {
    const payload = { installation: { id: 67890 } };
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

// ── capabilities.createAppJWT ─────────────────────────────────────────────────

describe("capabilities.createAppJWT", () => {
  it("produces a 3-part JWT string", async () => {
    const jwt = (await github.capabilities!.createAppJWT(testConfig)) as string;
    expect(jwt.split(".")).toHaveLength(3);
  });

  it("JWT header declares RS256 algorithm", async () => {
    const jwt = (await github.capabilities!.createAppJWT(testConfig)) as string;
    const [headerB64] = jwt.split(".");
    const header = JSON.parse(
      atob(headerB64!.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(headerB64!.length / 4) * 4, "=")),
    ) as { alg: string; typ: string };
    expect(header.alg).toBe("RS256");
    expect(header.typ).toBe("JWT");
  });

  it("JWT payload contains iss matching appId", async () => {
    const jwt = (await github.capabilities!.createAppJWT(testConfig)) as string;
    const parts = jwt.split(".");
    const payloadB64 = parts[1]!;
    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payloadB64.length / 4) * 4, "=")),
    ) as { iss: string; iat: number; exp: number };
    expect(payload.iss).toBe(testConfig.appId);
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });
});

// ── capabilities.getInstallationToken ─────────────────────────────────────────

describe("capabilities.getInstallationToken", () => {
  it("throws for non-numeric installationId", async () => {
    await expect(
      github.capabilities!.getInstallationToken(testConfig, "not-a-number"),
    ).rejects.toThrow("Invalid GitHub installation ID: must be numeric");
  });

  it("returns token string on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "ghs_installation_token_abc" }),
    });

    const token = (await github.capabilities!.getInstallationToken(testConfig, "12345")) as string;
    expect(token).toBe("ghs_installation_token_abc");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(
      github.capabilities!.getInstallationToken(testConfig, "12345"),
    ).rejects.toThrow("GitHub installation token request failed: 404");
  });

  it("throws when response is missing a valid token field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ not_token: "nope" }),
    });

    await expect(
      github.capabilities!.getInstallationToken(testConfig, "12345"),
    ).rejects.toThrow("GitHub installation token response missing valid token");
  });

  it("uses correct GitHub API endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "ghs_x" }),
    });

    await github.capabilities!.getInstallationToken(testConfig, "99999");

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("https://api.github.com/app/installations/99999/access_tokens");
  });
});

// ── capabilities.getInstallationDetails ──────────────────────────────────────

describe("capabilities.getInstallationDetails", () => {
  it("throws for non-numeric installationId", async () => {
    await expect(
      github.capabilities!.getInstallationDetails(testConfig, "abc"),
    ).rejects.toThrow("Invalid GitHub installation ID: must be numeric");
  });

  it("throws when response is missing account data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ permissions: {}, events: [], created_at: "2024-01-01T00:00:00Z" }),
    });

    await expect(
      github.capabilities!.getInstallationDetails(testConfig, "12345"),
    ).rejects.toThrow("GitHub installation response missing account data");
  });

  it("throws when account.login is not a string", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        account: { id: 42, type: "Organization", avatar_url: "" },
        permissions: {},
        events: [],
        created_at: "2024-01-01T00:00:00Z",
      }),
    });

    await expect(
      github.capabilities!.getInstallationDetails(testConfig, "12345"),
    ).rejects.toThrow("GitHub installation response missing account data");
  });

  it("returns full installation details on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockInstallationResponse,
    });

    const details = (await github.capabilities!.getInstallationDetails(
      testConfig,
      "12345",
    )) as typeof mockInstallationResponse;

    expect(details.account.login).toBe("my-org");
    expect(details.account.type).toBe("Organization");
    expect(details.permissions).toEqual({ contents: "read", metadata: "read" });
    expect(details.events).toContain("push");
    expect(details.created_at).toBe("2024-01-01T00:00:00Z");
  });

  it("maps 'User' account type correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockInstallationResponse,
        account: { ...mockInstallationResponse.account, type: "User", login: "alice" },
      }),
    });

    const details = (await github.capabilities!.getInstallationDetails(
      testConfig,
      "12345",
    )) as typeof mockInstallationResponse;

    expect(details.account.type).toBe("User");
    expect(details.account.login).toBe("alice");
  });

  it("maps non-User type as 'Organization'", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockInstallationResponse,
        account: { ...mockInstallationResponse.account, type: "Bot" },
      }),
    });

    const details = (await github.capabilities!.getInstallationDetails(
      testConfig,
      "12345",
    )) as typeof mockInstallationResponse;

    expect(details.account.type).toBe("Organization");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    await expect(
      github.capabilities!.getInstallationDetails(testConfig, "99999"),
    ).rejects.toThrow("GitHub installation details fetch failed: 403");
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
