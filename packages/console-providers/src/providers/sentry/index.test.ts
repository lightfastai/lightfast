/**
 * Unit tests for the Sentry provider — OAuth, webhook, and token encoding utilities.
 *
 * Sentry uses a composite token format: "installationId:token".
 * The provider encodes this at the OAuth layer to carry installationId
 * through the standard OAuthTokens interface.
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
import type { SentryConfig } from "./auth";
import { decodeSentryToken, encodeSentryToken } from "./auth";
import { sentry } from "./index";

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

const testConfig: SentryConfig = {
  appSlug: "my-sentry-app",
  clientId: "sentry-client-id",
  clientSecret: "sentry-client-secret",
};

// ── Fixtures ───────────────────────────────────────────────────────────────────

const installationId = "install-uuid-abc";
const authCode = "sentry-auth-code-xyz";
const compositeCode = `${installationId}:${authCode}`;

const sentryTokenResponse = {
  token: "sentry-access-token-123",
  refreshToken: "sentry-refresh-token-456",
  expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  scopes: ["project:read", "event:read"],
};

// ── encodeSentryToken / decodeSentryToken ─────────────────────────────────────

describe("encodeSentryToken", () => {
  it("encodes installationId and token with ':' separator", () => {
    const result = encodeSentryToken({
      installationId: "inst-id",
      token: "tok-abc",
    });
    expect(result).toBe("inst-id:tok-abc");
  });

  it("throws when installationId contains ':'", () => {
    expect(() =>
      encodeSentryToken({ installationId: "bad:id", token: "tok" })
    ).toThrow("installationId must not contain ':'");
  });

  it("token may contain ':' characters", () => {
    const result = encodeSentryToken({
      installationId: "inst-id",
      token: "tok:with:colons",
    });
    expect(result).toBe("inst-id:tok:with:colons");
  });
});

describe("decodeSentryToken", () => {
  it("decodes composite token into installationId and token", () => {
    const decoded = decodeSentryToken("inst-id:my-token");
    expect(decoded.installationId).toBe("inst-id");
    expect(decoded.token).toBe("my-token");
  });

  it("handles token containing ':' — only splits on first occurrence", () => {
    const decoded = decodeSentryToken("inst-id:tok:with:colons");
    expect(decoded.installationId).toBe("inst-id");
    expect(decoded.token).toBe("tok:with:colons");
  });

  it("throws when ':' separator is absent", () => {
    expect(() => decodeSentryToken("no-colon-here")).toThrow(
      "Invalid Sentry token: missing ':' separator"
    );
  });

  it("encodes then decodes round-trips correctly", () => {
    const original = { installationId: "my-install", token: "my-token-value" };
    const encoded = encodeSentryToken(original);
    const decoded = decodeSentryToken(encoded);
    expect(decoded).toEqual(original);
  });
});

// ── oauth.buildAuthUrl ─────────────────────────────────────────────────────────

describe("oauth.buildAuthUrl", () => {
  it("builds external install URL with appSlug", () => {
    const url = sentry.auth.buildAuthUrl(testConfig, "state-123");
    expect(url).toContain(
      "https://sentry.io/sentry-apps/my-sentry-app/external-install/"
    );
  });

  it("includes state query parameter", () => {
    const url = sentry.auth.buildAuthUrl(testConfig, "my-state");
    expect(url).toContain("state=my-state");
  });

  it("returns a string", () => {
    expect(typeof sentry.auth.buildAuthUrl(testConfig, "s")).toBe("string");
  });
});

// ── oauth.exchangeCode ────────────────────────────────────────────────────────

describe("oauth.exchangeCode", () => {
  it("returns OAuthTokens with accessToken on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sentryTokenResponse),
    });

    const tokens = await sentry.auth.exchangeCode(
      testConfig,
      compositeCode,
      ""
    );
    expect(tokens.accessToken).toBe("sentry-access-token-123");
  });

  it("encodes refreshToken as composite sentry token when present", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sentryTokenResponse),
    });

    const tokens = await sentry.auth.exchangeCode(
      testConfig,
      compositeCode,
      ""
    );
    // refreshToken should be composite: installationId:refreshToken
    const refreshToken = tokens.refreshToken ?? "";
    expect(refreshToken).toContain(":");
    const decoded = decodeSentryToken(refreshToken);
    expect(decoded.installationId).toBe(installationId);
    expect(decoded.token).toBe("sentry-refresh-token-456");
  });

  it("computes expiresIn from expiresAt in seconds", async () => {
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...sentryTokenResponse, expiresAt }),
    });

    const tokens = await sentry.auth.exchangeCode(
      testConfig,
      compositeCode,
      ""
    );
    // Should be roughly 3600 seconds — allow 10 second tolerance
    const expiresIn = tokens.expiresIn ?? 0;
    expect(expiresIn).toBeDefined();
    expect(expiresIn).toBeGreaterThan(3590);
    expect(expiresIn).toBeLessThanOrEqual(3600);
  });

  it("returns undefined expiresIn when expiresAt absent", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          token: "tok",
          refreshToken: undefined,
          expiresAt: undefined,
        }),
    });

    const tokens = await sentry.auth.exchangeCode(
      testConfig,
      compositeCode,
      ""
    );
    expect(tokens.expiresIn).toBeUndefined();
  });

  it("uses installationId from composite code in API endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sentryTokenResponse),
    });

    await sentry.auth.exchangeCode(testConfig, compositeCode, "");

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain(
      `sentry-app-installations/${installationId}/authorizations/`
    );
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(
      sentry.auth.exchangeCode(testConfig, compositeCode, "")
    ).rejects.toThrow("Sentry token exchange failed: 401");
  });

  it("throws when composite code has no ':' separator", async () => {
    await expect(
      sentry.auth.exchangeCode(testConfig, "no-colon", "")
    ).rejects.toThrow("Invalid Sentry token");
  });
});

// ── oauth.refreshToken ────────────────────────────────────────────────────────

describe("oauth.refreshToken", () => {
  it("returns new OAuthTokens on success", async () => {
    const newTokenResponse = {
      ...sentryTokenResponse,
      token: "new-sentry-token",
      refreshToken: "new-refresh-token",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(newTokenResponse),
    });

    const refreshComposite = encodeSentryToken({
      installationId,
      token: "old-refresh",
    });
    const tokens = await sentry.auth.refreshToken(testConfig, refreshComposite);
    expect(tokens.accessToken).toBe("new-sentry-token");
  });

  it("sends grant_type=refresh_token to the correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sentryTokenResponse),
    });

    const refreshComposite = encodeSentryToken({
      installationId,
      token: "old-refresh",
    });
    await sentry.auth.refreshToken(testConfig, refreshComposite);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      `sentry-app-installations/${installationId}/authorizations/`
    );
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.grant_type).toBe("refresh_token");
    expect(body.refresh_token).toBe("old-refresh");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

    const refreshComposite = encodeSentryToken({
      installationId,
      token: "old-refresh",
    });
    await expect(
      sentry.auth.refreshToken(testConfig, refreshComposite)
    ).rejects.toThrow("Sentry token refresh failed: 400");
  });

  it("re-encodes refreshToken with installationId when returned", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ...sentryTokenResponse,
          refreshToken: "new-refresh-raw",
        }),
    });

    const refreshComposite = encodeSentryToken({
      installationId,
      token: "old-refresh",
    });
    const tokens = await sentry.auth.refreshToken(testConfig, refreshComposite);
    const refreshToken = tokens.refreshToken ?? "";
    expect(refreshToken).toBeDefined();
    const decoded = decodeSentryToken(refreshToken);
    expect(decoded.installationId).toBe(installationId);
    expect(decoded.token).toBe("new-refresh-raw");
  });
});

// ── oauth.revokeToken ─────────────────────────────────────────────────────────

describe("oauth.revokeToken", () => {
  it("returns without fetching when accessToken has no ':' (not a composite token)", async () => {
    await expect(
      sentry.auth.revokeToken(testConfig, "plain-no-colon")
    ).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns without fetching when installationId is empty after decode", async () => {
    // Token starts with ':' → installationId = ""
    await expect(
      sentry.auth.revokeToken(testConfig, ":some-token")
    ).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends DELETE to sentry-app-installations endpoint when installationId is present", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const composite = encodeSentryToken({
      installationId: "inst-to-delete",
      token: "tok",
    });
    await expect(
      sentry.auth.revokeToken(testConfig, composite)
    ).resolves.toBeUndefined();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("sentry-app-installations/inst-to-delete/");
    expect(init.method).toBe("DELETE");
  });

  it("uses clientSecret (not accessToken) in Authorization header", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const composite = encodeSentryToken({
      installationId: "inst-abc",
      token: "tok",
    });
    await sentry.auth.revokeToken(testConfig, composite);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe(`Bearer ${testConfig.clientSecret}`);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const composite = encodeSentryToken({
      installationId: "inst-abc",
      token: "tok",
    });
    await expect(
      sentry.auth.revokeToken(testConfig, composite)
    ).rejects.toThrow("Sentry token revocation failed: 404");
  });
});

// ── oauth.processCallback ─────────────────────────────────────────────────────

describe("oauth.processCallback", () => {
  it("throws when code is missing", async () => {
    await expect(
      sentry.auth.processCallback(testConfig, { installationId })
    ).rejects.toThrow("missing code");
  });

  it("throws when installationId query param is missing", async () => {
    await expect(
      sentry.auth.processCallback(testConfig, { code: authCode })
    ).rejects.toThrow("missing installationId query param");
  });

  it("returns valid CallbackResult with connected status on happy path", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sentryTokenResponse),
    });

    const result = await sentry.auth.processCallback(testConfig, {
      code: authCode,
      installationId,
    });

    expect(result.status).toBe("connected");
    expect(result.externalId).toBe(installationId);
    if (result.status === "connected") {
      expect(result.accountInfo.sourceType).toBe("sentry");
      expect(result.accountInfo.version).toBe(1);
    }
  });

  it("accountInfo contains installation events list", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sentryTokenResponse),
    });

    const result = await sentry.auth.processCallback(testConfig, {
      code: authCode,
      installationId,
    });

    if (result.status === "connected") {
      expect(result.accountInfo.events).toContain("issue");
      expect(result.accountInfo.events).toContain("error");
    }
  });

  it("accountInfo has installationId field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sentryTokenResponse),
    });

    const result = await sentry.auth.processCallback(testConfig, {
      code: authCode,
      installationId,
    });

    if (result.status === "connected") {
      const info = result.accountInfo as { installationId?: string };
      expect(info.installationId).toBe(installationId);
    }
  });

  it("includes tokens in returned CallbackResult", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sentryTokenResponse),
    });

    const result = await sentry.auth.processCallback(testConfig, {
      code: authCode,
      installationId,
    });

    if (result.status === "connected") {
      expect(result.tokens.accessToken).toBe("sentry-access-token-123");
    }
  });
});

// ── webhook.signatureScheme + deriveVerifySignature ───────────────────────────

describe("webhook.signatureScheme", () => {
  it("has signatureScheme with hmac kind", () => {
    expect(sentry.webhook.signatureScheme.kind).toBe("hmac");
  });

  it("uses sha256 algorithm", () => {
    expect((sentry.webhook.signatureScheme as HmacScheme).algorithm).toBe(
      "sha256"
    );
  });

  it("uses sentry-hook-signature header", () => {
    expect(sentry.webhook.signatureScheme.signatureHeader).toBe(
      "sentry-hook-signature"
    );
  });

  it("has no prefix", () => {
    expect(
      (sentry.webhook.signatureScheme as HmacScheme).prefix
    ).toBeUndefined();
  });
});

describe("deriveVerifySignature(sentry.webhook.signatureScheme)", () => {
  const secret = "sentry-hook-secret";
  const body = '{"action":"created","data":{"issue":{"id":"sentry-issue-1"}}}';
  const verify = deriveVerifySignature(sentry.webhook.signatureScheme);

  it("returns false when sentry-hook-signature header is absent", () => {
    expect(verify(body, new Headers(), secret)).toBe(false);
  });

  it("returns false for incorrect signature", () => {
    const headers = new Headers({ "sentry-hook-signature": "wronghex" });
    expect(verify(body, headers, secret)).toBe(false);
  });

  it("returns true for valid HMAC-SHA256 signature", () => {
    const expected = computeHmac(body, secret, "SHA-256");
    const headers = new Headers({ "sentry-hook-signature": expected });
    expect(verify(body, headers, secret)).toBe(true);
  });

  it("uses clientSecret as the webhook secret", () => {
    expect(sentry.webhook.extractSecret(testConfig)).toBe(
      testConfig.clientSecret
    );
  });
});

// ── webhook.extractEventType ──────────────────────────────────────────────────

describe("webhook.extractEventType", () => {
  it("returns sentry-hook-resource header value", () => {
    const headers = new Headers({ "sentry-hook-resource": "issue" });
    expect(sentry.webhook.extractEventType(headers, {})).toBe("issue");
  });

  it("returns 'unknown' when header is absent", () => {
    expect(sentry.webhook.extractEventType(new Headers(), {})).toBe("unknown");
  });

  it("handles metric_alert resource type", () => {
    const headers = new Headers({ "sentry-hook-resource": "metric_alert" });
    expect(sentry.webhook.extractEventType(headers, {})).toBe("metric_alert");
  });
});

// ── webhook.extractDeliveryId ─────────────────────────────────────────────────

describe("webhook.extractDeliveryId", () => {
  it("returns resource:timestamp composite when both headers present", () => {
    const headers = new Headers({
      "sentry-hook-resource": "issue",
      "sentry-hook-timestamp": "1700000000",
    });
    expect(sentry.webhook.extractDeliveryId(headers, {})).toBe(
      "issue:1700000000"
    );
  });

  it("returns UUID when sentry-hook-resource is absent", () => {
    const headers = new Headers({ "sentry-hook-timestamp": "1700000000" });
    const id = sentry.webhook.extractDeliveryId(headers, {});
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("returns UUID when sentry-hook-timestamp is absent", () => {
    const headers = new Headers({ "sentry-hook-resource": "issue" });
    const id = sentry.webhook.extractDeliveryId(headers, {});
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

// ── webhook.extractResourceId ─────────────────────────────────────────────────

describe("webhook.extractResourceId", () => {
  it("returns installation.uuid when present", () => {
    const payload = { installation: { uuid: "install-uuid-xyz" } };
    expect(sentry.webhook.extractResourceId(payload)).toBe("install-uuid-xyz");
  });

  it("returns null when installation is absent", () => {
    expect(sentry.webhook.extractResourceId({})).toBeNull();
  });

  it("returns null when installation.uuid is absent", () => {
    expect(sentry.webhook.extractResourceId({ installation: {} })).toBeNull();
  });
});

// ── webhook.parsePayload ──────────────────────────────────────────────────────

describe("webhook.parsePayload", () => {
  it("accepts any object payload (loose schema)", () => {
    const raw = {
      action: "created",
      installation: { uuid: "abc" },
      arbitrary: "data",
    };
    expect(() => sentry.webhook.parsePayload(raw)).not.toThrow();
  });

  it("accepts payload without installation field", () => {
    expect(() =>
      sentry.webhook.parsePayload({ action: "created" })
    ).not.toThrow();
  });
});
