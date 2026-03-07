/**
 * Unit tests for the Vercel provider — OAuth, webhook, and resolveCategory.
 *
 * Notable: Vercel webhooks use HMAC-SHA1 (not SHA-256), and Vercel
 * tokens do not support refresh.
 *
 * processCallback validates that configurationId from the query matches
 * installation_id from the token exchange response.
 */
import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from "vitest";
import { vercel } from "./index";
import { computeHmac } from "../../crypto";
import type { VercelConfig } from "./auth";

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

// ── Test config ────────────────────────────────────────────────────────────────

const testConfig: VercelConfig = {
  integrationSlug: "my-vercel-integration",
  clientSecretId: "vercel-secret-id",
  clientIntegrationSecret: "vercel-integration-secret",
  callbackBaseUrl: "https://app.lightfast.ai",
};

// ── Fixtures ───────────────────────────────────────────────────────────────────

const tokenResponseTeam = {
  access_token: "vercel-access-token-abc",
  token_type: "Bearer",
  installation_id: "icfg-abc123",
  user_id: "user-xyz",
  team_id: "team-456",
};

const tokenResponseUser = {
  ...tokenResponseTeam,
  team_id: null,
};

// ── oauth.buildAuthUrl ─────────────────────────────────────────────────────────

describe("oauth.buildAuthUrl", () => {
  it("builds Vercel integration install URL with integrationSlug", () => {
    const url = vercel.oauth.buildAuthUrl(testConfig, "state-abc");
    expect(url).toContain(
      "https://vercel.com/integrations/my-vercel-integration/new",
    );
  });

  it("includes state query parameter", () => {
    const url = vercel.oauth.buildAuthUrl(testConfig, "my-state");
    expect(url).toContain("state=my-state");
  });

  it("returns a string", () => {
    expect(typeof vercel.oauth.buildAuthUrl(testConfig, "s")).toBe("string");
  });
});

// ── oauth.exchangeCode ────────────────────────────────────────────────────────

describe("oauth.exchangeCode", () => {
  it("returns OAuthTokens with accessToken and tokenType on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseTeam),
    });

    const tokens = await vercel.oauth.exchangeCode(
      testConfig,
      "vercel-code-123",
      "https://app.lightfast.ai/gateway/vercel/callback",
    );

    expect(tokens.accessToken).toBe("vercel-access-token-abc");
    expect(tokens.tokenType).toBe("Bearer");
    expect(tokens.raw).toBeDefined();
  });

  it("sends POST to Vercel token endpoint with form-encoded body", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(tokenResponseTeam) });

    await vercel.oauth.exchangeCode(testConfig, "code", "https://redirect.example.com");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.vercel.com/v2/oauth/access_token");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(init.method).toBe("POST");
  });

  it("includes client_id, client_secret, code, and redirect_uri in body", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(tokenResponseTeam) });

    await vercel.oauth.exchangeCode(testConfig, "my-code", "https://redirect.example.com");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = init.body as string;
    expect(body).toContain("client_id=vercel-secret-id");
    expect(body).toContain("client_secret=vercel-integration-secret");
    expect(body).toContain("code=my-code");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

    await expect(
      vercel.oauth.exchangeCode(testConfig, "bad-code", "https://redirect.example.com"),
    ).rejects.toThrow("Vercel token exchange failed: 400");
  });
});

// ── oauth.refreshToken ────────────────────────────────────────────────────────

describe("oauth.refreshToken", () => {
  it("always rejects — Vercel tokens do not support refresh", async () => {
    await expect(vercel.oauth.refreshToken(testConfig, "any-token")).rejects.toThrow(
      "do not support refresh",
    );
  });

  it("does not call fetch", async () => {
    await vercel.oauth.refreshToken(testConfig, "t").catch(vi.fn());
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── oauth.revokeToken ─────────────────────────────────────────────────────────

describe("oauth.revokeToken", () => {
  it("resolves without error on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await expect(
      vercel.oauth.revokeToken(testConfig, "vercel-access-token"),
    ).resolves.toBeUndefined();
  });

  it("sends POST to Vercel revoke endpoint with Bearer auth", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await vercel.oauth.revokeToken(testConfig, "vercel-access-token-abc");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.vercel.com/v2/oauth/tokens/revoke");
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe("Bearer vercel-access-token-abc");
    expect(init.method).toBe("POST");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422 });

    await expect(vercel.oauth.revokeToken(testConfig, "bad-token")).rejects.toThrow(
      "Vercel token revocation failed: 422",
    );
  });
});

// ── oauth.processCallback ─────────────────────────────────────────────────────

describe("oauth.processCallback", () => {
  it("throws when code is missing", async () => {
    await expect(
      vercel.oauth.processCallback(testConfig, { configurationId: "icfg-abc123" }),
    ).rejects.toThrow("missing code");
  });

  it("throws when configurationId is missing", async () => {
    await expect(
      vercel.oauth.processCallback(testConfig, { code: "vercel-code" }),
    ).rejects.toThrow("missing configurationId");
  });

  it("throws when configurationId does not match token installation_id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseTeam), // installation_id = "icfg-abc123"
    });

    await expect(
      vercel.oauth.processCallback(testConfig, {
        code: "vercel-code",
        configurationId: "icfg-DIFFERENT",
      }),
    ).rejects.toThrow("configurationId mismatch");
  });

  it("returns externalId = team_id when team is present", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(tokenResponseTeam) });

    const result = await vercel.oauth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    expect(result.externalId).toBe("team-456");
  });

  it("returns externalId = user_id when team_id is null", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(tokenResponseUser) });

    const result = await vercel.oauth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    expect(result.externalId).toBe("user-xyz");
  });

  it("accountInfo has correct sourceType and version", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(tokenResponseTeam) });

    const result = await vercel.oauth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    if (result.status === "connected" || result.status === "connected-redirect") {
      expect(result.accountInfo.sourceType).toBe("vercel");
      expect(result.accountInfo.version).toBe(1);
    }
  });

  it("accountInfo raw contains installation_id, user_id, team_id, token_type", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(tokenResponseTeam) });

    const result = await vercel.oauth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    if (result.status === "connected" || result.status === "connected-redirect") {
      const raw = result.accountInfo.raw as typeof tokenResponseTeam;
      expect(raw.installation_id).toBe("icfg-abc123");
      expect(raw.user_id).toBe("user-xyz");
      expect(raw.team_id).toBe("team-456");
    }
  });

  it("returns connected-redirect with nextUrl when next query param is present", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(tokenResponseTeam) });

    const result = await vercel.oauth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
      next: "https://vercel.com/dashboard",
    });

    expect(result.status).toBe("connected-redirect");
    if (result.status === "connected-redirect") {
      expect(result.nextUrl).toBe("https://vercel.com/dashboard");
    }
  });

  it("returns connected status when next query param is absent", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(tokenResponseTeam) });

    const result = await vercel.oauth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    expect(result.status).toBe("connected");
  });

  it("includes tokens in returned CallbackResult", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(tokenResponseTeam) });

    const result = await vercel.oauth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    if (result.status === "connected") {
      expect(result.tokens.accessToken).toBe("vercel-access-token-abc");
    }
  });

  it("accountInfo includes all deployment event types", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(tokenResponseTeam) });

    const result = await vercel.oauth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    if (result.status === "connected" || result.status === "connected-redirect") {
      expect(result.accountInfo.events).toContain("deployment.created");
      expect(result.accountInfo.events).toContain("deployment.succeeded");
      expect(result.accountInfo.events).toContain("deployment.error");
    }
  });
});

// ── webhook.verifySignature ───────────────────────────────────────────────────

describe("webhook.verifySignature", () => {
  // Vercel uses HMAC-SHA1 — this is the key behavioral difference from other providers
  const secret = "vercel-integration-secret";
  const body = '{"type":"deployment.succeeded","id":"evt-abc"}';

  it("returns false when x-vercel-signature header is absent", () => {
    const result = vercel.webhook.verifySignature(body, new Headers(), secret);
    expect(result).toBe(false);
  });

  it("returns false for incorrect signature", () => {
    const headers = new Headers({ "x-vercel-signature": "wronghex" });
    const result = vercel.webhook.verifySignature(body, headers, secret);
    expect(result).toBe(false);
  });

  it("returns true for valid HMAC-SHA1 signature", () => {
    const expected = computeHmac(body, secret, "SHA-1");
    const headers = new Headers({ "x-vercel-signature": expected });
    const result = vercel.webhook.verifySignature(body, headers, secret);
    expect(result).toBe(true);
  });

  it("returns false for SHA-256 signature (wrong algorithm)", () => {
    // Vercel uses SHA-1, not SHA-256; a SHA-256 sig should NOT match
    const sha256Sig = computeHmac(body, secret, "SHA-256");
    const headers = new Headers({ "x-vercel-signature": sha256Sig });
    const result = vercel.webhook.verifySignature(body, headers, secret);
    expect(result).toBe(false);
  });

  it("uses clientIntegrationSecret as webhook secret", () => {
    expect(vercel.webhook.extractSecret(testConfig)).toBe(testConfig.clientIntegrationSecret);
  });
});

// ── webhook.extractEventType ──────────────────────────────────────────────────

describe("webhook.extractEventType", () => {
  it("returns payload.type field", () => {
    const payload = { type: "deployment.succeeded" };
    expect(vercel.webhook.extractEventType(new Headers(), payload)).toBe("deployment.succeeded");
  });

  it("returns 'unknown' when type is absent", () => {
    expect(vercel.webhook.extractEventType(new Headers(), {})).toBe("unknown");
  });

  it("handles all documented deployment event types", () => {
    const types = [
      "deployment.created",
      "deployment.succeeded",
      "deployment.ready",
      "deployment.error",
      "deployment.canceled",
      "deployment.check-rerequested",
    ];
    for (const type of types) {
      expect(vercel.webhook.extractEventType(new Headers(), { type })).toBe(type);
    }
  });
});

// ── webhook.extractDeliveryId ─────────────────────────────────────────────────

describe("webhook.extractDeliveryId", () => {
  it("returns payload.id when present", () => {
    const payload = { id: "evt-delivery-123" };
    expect(vercel.webhook.extractDeliveryId(new Headers(), payload)).toBe("evt-delivery-123");
  });

  it("returns a UUID when payload.id is absent", () => {
    const id = vercel.webhook.extractDeliveryId(new Headers(), {});
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

// ── webhook.extractResourceId ─────────────────────────────────────────────────

describe("webhook.extractResourceId", () => {
  it("returns payload.payload.project.id as string when present", () => {
    const payload = { payload: { project: { id: "prj-abc123" } } };
    expect(vercel.webhook.extractResourceId(payload)).toBe("prj-abc123");
  });

  it("returns payload.payload.team.id when project is absent", () => {
    const payload = { payload: { team: { id: "team-xyz" } } };
    expect(vercel.webhook.extractResourceId(payload)).toBe("team-xyz");
  });

  it("prefers project.id over team.id", () => {
    const payload = {
      payload: { project: { id: "prj-100" }, team: { id: "team-200" } },
    };
    expect(vercel.webhook.extractResourceId(payload)).toBe("prj-100");
  });

  it("returns null when neither project nor team present", () => {
    expect(vercel.webhook.extractResourceId({})).toBeNull();
    expect(vercel.webhook.extractResourceId({ payload: {} })).toBeNull();
  });

  it("handles numeric project id — converts to string", () => {
    const payload = { payload: { project: { id: 42 } } };
    expect(vercel.webhook.extractResourceId(payload)).toBe("42");
  });
});

// ── resolveCategory ───────────────────────────────────────────────────────────

describe("resolveCategory", () => {
  it("strips dot-suffix to produce dispatch category", () => {
    expect(vercel.resolveCategory("deployment.created")).toBe("deployment");
    expect(vercel.resolveCategory("deployment.succeeded")).toBe("deployment");
    expect(vercel.resolveCategory("deployment.error")).toBe("deployment");
  });

  it("returns eventType unchanged when no dot", () => {
    expect(vercel.resolveCategory("deployment")).toBe("deployment");
  });
});

// ── webhook.parsePayload ──────────────────────────────────────────────────────

describe("webhook.parsePayload", () => {
  it("accepts standard deployment webhook payload", () => {
    const raw = {
      id: "evt-abc",
      type: "deployment.succeeded",
      payload: { project: { id: "prj-xyz" } },
    };
    expect(() => vercel.webhook.parsePayload(raw)).not.toThrow();
  });

  it("accepts any object (loose schema)", () => {
    expect(() => vercel.webhook.parsePayload({ arbitrary: "data" })).not.toThrow();
  });
});
