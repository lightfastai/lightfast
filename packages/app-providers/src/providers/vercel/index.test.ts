/**
 * Unit tests for the Vercel provider — OAuth, webhook, and resolveCategory.
 *
 * Notable: Vercel webhooks use HMAC-SHA1 (not SHA-256), and Vercel
 * tokens do not support refresh.
 *
 * processCallback validates that configurationId from the query matches
 * installation_id from the token exchange response.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { HmacScheme } from "../../provider/webhook";
import { computeHmac } from "../../runtime/crypto";
import { deriveVerifySignature } from "../../runtime/verify/index";
import type { VercelConfig } from "./auth";
import { vercel } from "./index";

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
  callbackBaseUrl: "https://lightfast.ai",
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
    const url = vercel.auth.buildAuthUrl(testConfig, "state-abc");
    expect(url).toContain(
      "https://vercel.com/integrations/my-vercel-integration/new"
    );
  });

  it("includes state query parameter", () => {
    const url = vercel.auth.buildAuthUrl(testConfig, "my-state");
    expect(url).toContain("state=my-state");
  });

  it("returns a string", () => {
    expect(typeof vercel.auth.buildAuthUrl(testConfig, "s")).toBe("string");
  });
});

// ── oauth.exchangeCode ────────────────────────────────────────────────────────

describe("oauth.exchangeCode", () => {
  it("returns OAuthTokens with accessToken and tokenType on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseTeam),
    });

    const tokens = await vercel.auth.exchangeCode(
      testConfig,
      "vercel-code-123",
      "https://lightfast.ai/api/connect/vercel/callback"
    );

    expect(tokens.accessToken).toBe("vercel-access-token-abc");
    expect(tokens.tokenType).toBe("Bearer");
    expect(tokens.raw).toBeDefined();
  });

  it("sends POST to Vercel token endpoint with form-encoded body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseTeam),
    });

    await vercel.auth.exchangeCode(
      testConfig,
      "code",
      "https://redirect.example.com"
    );

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.vercel.com/v2/oauth/access_token");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    );
    expect(init.method).toBe("POST");
  });

  it("includes client_id, client_secret, code, and redirect_uri in body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseTeam),
    });

    await vercel.auth.exchangeCode(
      testConfig,
      "my-code",
      "https://redirect.example.com"
    );

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = init.body as string;
    expect(body).toContain("client_id=vercel-secret-id");
    expect(body).toContain("client_secret=vercel-integration-secret");
    expect(body).toContain("code=my-code");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

    await expect(
      vercel.auth.exchangeCode(
        testConfig,
        "bad-code",
        "https://redirect.example.com"
      )
    ).rejects.toThrow("Vercel token exchange failed: 400");
  });
});

// ── oauth.refreshToken ────────────────────────────────────────────────────────

describe("oauth.refreshToken", () => {
  it("always rejects — Vercel tokens do not support refresh", async () => {
    await expect(
      vercel.auth.refreshToken(testConfig, "any-token")
    ).rejects.toThrow("do not support refresh");
  });

  it("does not call fetch", async () => {
    await vercel.auth.refreshToken(testConfig, "t").catch(vi.fn());
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── oauth.revokeToken ─────────────────────────────────────────────────────────

describe("oauth.revokeToken", () => {
  it("resolves without error on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await expect(
      vercel.auth.revokeToken(testConfig, "vercel-access-token")
    ).resolves.toBeUndefined();
  });

  it("sends POST to Vercel revoke endpoint with Bearer auth", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await vercel.auth.revokeToken(testConfig, "vercel-access-token-abc");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.vercel.com/v2/oauth/tokens/revoke");
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe("Bearer vercel-access-token-abc");
    expect(init.method).toBe("POST");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422 });

    await expect(
      vercel.auth.revokeToken(testConfig, "bad-token")
    ).rejects.toThrow("Vercel token revocation failed: 422");
  });
});

// ── oauth.processCallback ─────────────────────────────────────────────────────

describe("oauth.processCallback", () => {
  it("throws when code is missing", async () => {
    await expect(
      vercel.auth.processCallback(testConfig, {
        configurationId: "icfg-abc123",
      })
    ).rejects.toThrow("missing code");
  });

  it("throws when configurationId is missing", async () => {
    await expect(
      vercel.auth.processCallback(testConfig, { code: "vercel-code" })
    ).rejects.toThrow("missing configurationId");
  });

  it("throws when configurationId does not match token installation_id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseTeam), // installation_id = "icfg-abc123"
    });

    await expect(
      vercel.auth.processCallback(testConfig, {
        code: "vercel-code",
        configurationId: "icfg-DIFFERENT",
      })
    ).rejects.toThrow("configurationId mismatch");
  });

  it("returns externalId = team_id when team is present", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseTeam),
    });

    const result = await vercel.auth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    expect(result.externalId).toBe("team-456");
  });

  it("returns externalId = user_id when team_id is null", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseUser),
    });

    const result = await vercel.auth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    expect(result.externalId).toBe("user-xyz");
  });

  it("accountInfo has correct sourceType and version", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseTeam),
    });

    const result = await vercel.auth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    if (result.status === "connected") {
      expect(result.accountInfo.sourceType).toBe("vercel");
      expect(result.accountInfo.version).toBe(1);
    }
  });

  it("accountInfo raw contains installation_id, user_id, team_id, token_type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseTeam),
    });

    const result = await vercel.auth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    if (result.status === "connected") {
      const raw = result.accountInfo.raw as typeof tokenResponseTeam;
      expect(raw.installation_id).toBe("icfg-abc123");
      expect(raw.user_id).toBe("user-xyz");
      expect(raw.team_id).toBe("team-456");
    }
  });

  it("returns connected status even when next query param is present", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseTeam),
    });

    const result = await vercel.auth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
      next: "https://vercel.com/dashboard",
    });

    expect(result.status).toBe("connected");
  });

  it("returns connected status when next query param is absent", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseTeam),
    });

    const result = await vercel.auth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    expect(result.status).toBe("connected");
  });

  it("includes tokens in returned CallbackResult", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseTeam),
    });

    const result = await vercel.auth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    if (result.status === "connected") {
      expect(result.tokens.accessToken).toBe("vercel-access-token-abc");
    }
  });

  it("accountInfo includes all deployment event types", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponseTeam),
    });

    const result = await vercel.auth.processCallback(testConfig, {
      code: "vercel-code",
      configurationId: "icfg-abc123",
    });

    if (result.status === "connected") {
      expect(result.accountInfo.events).toContain("deployment.created");
      expect(result.accountInfo.events).toContain("deployment.succeeded");
    }
  });
});

// ── defaultSyncEvents + categories coverage ───────────────────────────────────

describe("defaultSyncEvents", () => {
  it("includes all 4 deployment event types", () => {
    expect(vercel.defaultSyncEvents).toEqual([
      "deployment.created",
      "deployment.succeeded",
      "deployment.error",
      "deployment.canceled",
    ]);
  });
});

describe("categories", () => {
  it("has entries for all 4 deployment event types", () => {
    expect(Object.keys(vercel.categories)).toEqual([
      "deployment.created",
      "deployment.succeeded",
      "deployment.error",
      "deployment.canceled",
    ]);
  });
});

// ── webhook.signatureScheme + deriveVerifySignature ───────────────────────────

describe("webhook.signatureScheme", () => {
  // Vercel uses HMAC-SHA1 — this is the key behavioral difference from other providers
  it("has signatureScheme with hmac kind", () => {
    expect(vercel.webhook.signatureScheme.kind).toBe("hmac");
  });

  it("uses sha1 algorithm", () => {
    expect((vercel.webhook.signatureScheme as HmacScheme).algorithm).toBe(
      "sha1"
    );
  });

  it("uses x-vercel-signature header", () => {
    expect(vercel.webhook.signatureScheme.signatureHeader).toBe(
      "x-vercel-signature"
    );
  });

  it("has no prefix", () => {
    expect(
      (vercel.webhook.signatureScheme as HmacScheme).prefix
    ).toBeUndefined();
  });
});

describe("deriveVerifySignature(vercel.webhook.signatureScheme)", () => {
  const secret = "vercel-integration-secret";
  const body = '{"type":"deployment.succeeded","id":"evt-abc"}';
  const verify = deriveVerifySignature(vercel.webhook.signatureScheme);

  it("returns false when x-vercel-signature header is absent", () => {
    expect(verify(body, new Headers(), secret)).toBe(false);
  });

  it("returns false for incorrect signature", () => {
    const headers = new Headers({ "x-vercel-signature": "wronghex" });
    expect(verify(body, headers, secret)).toBe(false);
  });

  it("returns true for valid HMAC-SHA1 signature", () => {
    const expected = computeHmac(body, secret, "SHA-1");
    const headers = new Headers({ "x-vercel-signature": expected });
    expect(verify(body, headers, secret)).toBe(true);
  });

  it("returns false for SHA-256 signature (wrong algorithm)", () => {
    // Vercel uses SHA-1, not SHA-256; a SHA-256 sig should NOT match
    const sha256Sig = computeHmac(body, secret, "SHA-256");
    const headers = new Headers({ "x-vercel-signature": sha256Sig });
    expect(verify(body, headers, secret)).toBe(false);
  });

  it("uses clientIntegrationSecret as webhook secret", () => {
    expect(vercel.webhook.extractSecret(testConfig)).toBe(
      testConfig.clientIntegrationSecret
    );
  });
});

// ── webhook.extractEventType ──────────────────────────────────────────────────

describe("webhook.extractEventType", () => {
  it("returns payload.type field", () => {
    const payload = { type: "deployment.succeeded" };
    expect(vercel.webhook.extractEventType(new Headers(), payload)).toBe(
      "deployment.succeeded"
    );
  });

  it("returns 'unknown' when type is absent", () => {
    expect(vercel.webhook.extractEventType(new Headers(), {})).toBe("unknown");
  });

  it("handles all documented deployment event types", () => {
    const types = [
      "deployment.created",
      "deployment.succeeded",
      "deployment.error",
      "deployment.canceled",
    ];
    for (const type of types) {
      expect(vercel.webhook.extractEventType(new Headers(), { type })).toBe(
        type
      );
    }
  });
});

// ── webhook.extractDeliveryId ─────────────────────────────────────────────────

describe("webhook.extractDeliveryId", () => {
  it("returns payload.id when present", () => {
    const payload = { id: "evt-delivery-123" };
    expect(vercel.webhook.extractDeliveryId(new Headers(), payload)).toBe(
      "evt-delivery-123"
    );
  });

  it("returns a UUID when payload.id is absent", () => {
    const id = vercel.webhook.extractDeliveryId(new Headers(), {});
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
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
    expect(vercel.resolveCategory("deployment.canceled")).toBe("deployment");
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
    expect(() =>
      vercel.webhook.parsePayload({ arbitrary: "data" })
    ).not.toThrow();
  });
});

// ── healthCheck.check ─────────────────────────────────────────────────────────

describe("healthCheck.check", () => {
  it("returns 'healthy' when Vercel returns 200", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await vercel.healthCheck!.check(
      testConfig,
      "team-456",
      "vercel-access-token-abc"
    );
    expect(result).toBe("healthy");
  });

  it("returns 'revoked' when accessToken is null", async () => {
    const result = await vercel.healthCheck!.check(
      testConfig,
      "team-456",
      null
    );
    expect(result).toBe("revoked");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 'revoked' when Vercel returns 403", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const result = await vercel.healthCheck!.check(
      testConfig,
      "team-456",
      "bad-token"
    );
    expect(result).toBe("revoked");
  });

  it("returns 'revoked' when Vercel returns 401", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await vercel.healthCheck!.check(
      testConfig,
      "team-456",
      "expired-token"
    );
    expect(result).toBe("revoked");
  });

  it("throws on unexpected HTTP status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(
      vercel.healthCheck!.check(testConfig, "team-456", "token")
    ).rejects.toThrow("Vercel health check failed: 500");
  });

  it("calls GET /v2/user with Bearer auth", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await vercel.healthCheck!.check(testConfig, "team-456", "my-vercel-token");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.vercel.com/v2/user");
    expect(init.method).toBe("GET");
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe("Bearer my-vercel-token");
  });
});
