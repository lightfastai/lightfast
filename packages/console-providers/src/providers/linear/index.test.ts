/**
 * Unit tests for the Linear provider — OAuth, webhook, and resolveCategory.
 *
 * Two-step OAuth processCallback needs fetch mocked twice in order:
 *  1. POST /oauth/token  (token exchange)
 *  2. POST /graphql      (viewer query)
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
import { computeHmac } from "../../crypto";
import type { LinearConfig } from "./auth";
import { linear } from "./index";

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

const testConfig: LinearConfig = {
  clientId: "lin_client_id",
  clientSecret: "lin_client_secret",
  webhookSigningSecret: "lin_signing_secret",
  callbackBaseUrl: "https://app.lightfast.ai",
};

// ── Fixtures ───────────────────────────────────────────────────────────────────

const tokenResponse = {
  access_token: "lin_api_token123",
  refresh_token: "lin_refresh_token456",
  token_type: "Bearer",
  scope: "read,write",
  expires_in: 3600,
};

const viewerWithOrgResponse = {
  data: {
    viewer: {
      id: "viewer-id-abc",
      organization: { id: "org-id-xyz", name: "My Org", urlKey: "my-org" },
    },
  },
};

const viewerWithoutOrgResponse = {
  data: {
    viewer: { id: "viewer-id-abc", organization: null },
  },
};

// ── oauth.buildAuthUrl ─────────────────────────────────────────────────────────

describe("oauth.buildAuthUrl", () => {
  it("builds Linear OAuth authorization URL", () => {
    const url = linear.oauth.buildAuthUrl(testConfig, "state-xyz");
    expect(url).toContain("https://linear.app/oauth/authorize");
  });

  it("includes client_id, response_type, and state", () => {
    const url = linear.oauth.buildAuthUrl(testConfig, "my-state");
    expect(url).toContain("client_id=lin_client_id");
    expect(url).toContain("response_type=code");
    expect(url).toContain("state=my-state");
  });

  it("includes redirect_uri using callbackBaseUrl", () => {
    const url = linear.oauth.buildAuthUrl(testConfig, "s");
    expect(url).toContain(
      encodeURIComponent("https://app.lightfast.ai/gateway/linear/callback")
    );
  });

  it("uses default scopes read,write when not specified", () => {
    const url = linear.oauth.buildAuthUrl(testConfig, "s");
    expect(url).toContain("scope=read%2Cwrite");
  });

  it("uses custom scopes from options", () => {
    const url = linear.oauth.buildAuthUrl(testConfig, "s", {
      scopes: ["read", "issues:write"],
    });
    expect(url).toContain("scope=read%2Cissues%3Awrite");
  });
});

// ── oauth.exchangeCode ────────────────────────────────────────────────────────

describe("oauth.exchangeCode", () => {
  it("returns OAuthTokens with all fields on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponse),
    });

    const tokens = await linear.oauth.exchangeCode(
      testConfig,
      "auth-code-123",
      "https://app.lightfast.ai/gateway/linear/callback"
    );

    expect(tokens.accessToken).toBe("lin_api_token123");
    expect(tokens.refreshToken).toBe("lin_refresh_token456");
    expect(tokens.tokenType).toBe("Bearer");
    expect(tokens.scope).toBe("read,write");
    expect(tokens.expiresIn).toBe(3600);
  });

  it("sends POST with form-encoded body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponse),
    });

    await linear.oauth.exchangeCode(
      testConfig,
      "code",
      "https://redirect.example.com"
    );

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.linear.app/oauth/token");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    );
    expect(init.body).toContain("grant_type=authorization_code");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

    await expect(
      linear.oauth.exchangeCode(
        testConfig,
        "bad-code",
        "https://redirect.example.com"
      )
    ).rejects.toThrow("Linear token exchange failed: 400");
  });
});

// ── oauth.refreshToken ────────────────────────────────────────────────────────

describe("oauth.refreshToken", () => {
  it("returns new OAuthTokens on success", async () => {
    const refreshed = {
      ...tokenResponse,
      access_token: "lin_new_token",
      refresh_token: "lin_new_refresh",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(refreshed),
    });

    const tokens = await linear.oauth.refreshToken(
      testConfig,
      "lin_refresh_token456"
    );
    expect(tokens.accessToken).toBe("lin_new_token");
    expect(tokens.refreshToken).toBe("lin_new_refresh");
  });

  it("sends grant_type=refresh_token in request body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(tokenResponse),
    });

    await linear.oauth.refreshToken(testConfig, "refresh-token");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.body).toContain("grant_type=refresh_token");
    expect(init.body).toContain("refresh_token=refresh-token");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(
      linear.oauth.refreshToken(testConfig, "expired-token")
    ).rejects.toThrow("Linear token refresh failed: 401");
  });
});

// ── oauth.revokeToken ─────────────────────────────────────────────────────────

describe("oauth.revokeToken", () => {
  it("resolves without error on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await expect(
      linear.oauth.revokeToken(testConfig, "lin_api_token")
    ).resolves.toBeUndefined();
  });

  it("sends Bearer authorization header with the access token", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await linear.oauth.revokeToken(testConfig, "my-access-token");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.linear.app/oauth/revoke");
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe("Bearer my-access-token");
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(linear.oauth.revokeToken(testConfig, "token")).rejects.toThrow(
      "Linear token revocation failed: 500"
    );
  });
});

// ── oauth.processCallback ─────────────────────────────────────────────────────

describe("oauth.processCallback", () => {
  it("throws when code is missing", async () => {
    await expect(linear.oauth.processCallback(testConfig, {})).rejects.toThrow(
      "missing code"
    );
  });

  it("returns CallbackResult with connected status and org externalId", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(viewerWithOrgResponse),
      });

    const result = await linear.oauth.processCallback(testConfig, {
      code: "lin-code-123",
    });

    expect(result.status).toBe("connected");
    expect(result.externalId).toBe("org-id-xyz");
    if (result.status === "connected") {
      expect(result.accountInfo.sourceType).toBe("linear");
      expect(result.accountInfo.version).toBe(1);
    }
  });

  it("does not include organization in accountInfo (display data resolved live)", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(viewerWithOrgResponse),
      });

    const result = await linear.oauth.processCallback(testConfig, {
      code: "lin-code",
    });

    if (result.status === "connected") {
      // organization field is removed — display data is resolved live in connections.linear.get
      expect(result.accountInfo).not.toHaveProperty("organization");
      // raw contains only OAuth metadata
      expect(result.accountInfo.raw).toMatchObject({
        token_type: "Bearer",
        scope: "read,write",
      });
    }
  });

  it("returns viewer.id as externalId when no organization", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(viewerWithoutOrgResponse),
      });

    const result = await linear.oauth.processCallback(testConfig, {
      code: "lin-code",
    });

    expect(result.externalId).toBe("viewer-id-abc");
    if (result.status === "connected") {
      const info = result.accountInfo as { organization?: unknown };
      expect(info.organization).toBeUndefined();
    }
  });

  it("throws when Linear API returns neither org nor viewer id", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { viewer: null } }),
      });

    await expect(
      linear.oauth.processCallback(testConfig, { code: "lin-code" })
    ).rejects.toThrow("Linear API did not return a viewer or organization ID");
  });

  it("includes tokens in returned CallbackResult", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(viewerWithOrgResponse),
      });

    const result = await linear.oauth.processCallback(testConfig, {
      code: "lin-code",
    });
    if (result.status === "connected") {
      expect(result.tokens.accessToken).toBe("lin_api_token123");
    }
  });

  it("throws when token exchange fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

    await expect(
      linear.oauth.processCallback(testConfig, { code: "bad-code" })
    ).rejects.toThrow("Linear token exchange failed: 400");
  });

  it("uses correct redirect_uri in token exchange", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(viewerWithOrgResponse),
      });

    await linear.oauth.processCallback(testConfig, { code: "lin-code" });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.body).toContain(
      encodeURIComponent("https://app.lightfast.ai/gateway/linear/callback")
    );
  });
});

// ── webhook.verifySignature ───────────────────────────────────────────────────

describe("webhook.verifySignature", () => {
  const secret = "lin_signing_secret";
  const body = '{"type":"Issue","action":"created","data":{"id":"issue-1"}}';

  it("returns false when linear-signature header is absent", () => {
    const result = linear.webhook.verifySignature(body, new Headers(), secret);
    expect(result).toBe(false);
  });

  it("returns false for an incorrect signature", () => {
    const headers = new Headers({ "linear-signature": "badhex" });
    const result = linear.webhook.verifySignature(body, headers, secret);
    expect(result).toBe(false);
  });

  it("returns true for a valid HMAC-SHA256 signature", () => {
    const expected = computeHmac(body, secret, "SHA-256");
    const headers = new Headers({ "linear-signature": expected });
    const result = linear.webhook.verifySignature(body, headers, secret);
    expect(result).toBe(true);
  });

  it("returns false for correct signature with wrong secret", () => {
    const sig = computeHmac(body, "wrong-secret", "SHA-256");
    const headers = new Headers({ "linear-signature": sig });
    const result = linear.webhook.verifySignature(body, headers, secret);
    expect(result).toBe(false);
  });
});

// ── webhook.extractEventType ──────────────────────────────────────────────────

describe("webhook.extractEventType", () => {
  it("returns type:action composite when both present", () => {
    const payload = { type: "Issue", action: "created" };
    expect(linear.webhook.extractEventType(new Headers(), payload)).toBe(
      "Issue:created"
    );
  });

  it("returns type only when action is absent", () => {
    const payload = { type: "Issue" };
    expect(linear.webhook.extractEventType(new Headers(), payload)).toBe(
      "Issue"
    );
  });

  it("returns 'unknown' when type is absent", () => {
    expect(linear.webhook.extractEventType(new Headers(), {})).toBe("unknown");
  });
});

// ── webhook.extractDeliveryId ─────────────────────────────────────────────────

describe("webhook.extractDeliveryId", () => {
  it("returns linear-delivery header when present", () => {
    const headers = new Headers({ "linear-delivery": "linear-del-id-123" });
    expect(linear.webhook.extractDeliveryId(headers, {})).toBe(
      "linear-del-id-123"
    );
  });

  it("returns deterministic fingerprint when header is absent", () => {
    const payload = {
      type: "Issue",
      action: "created",
      data: { id: "issue-1" },
    };
    const id1 = linear.webhook.extractDeliveryId(new Headers(), payload);
    const id2 = linear.webhook.extractDeliveryId(new Headers(), payload);
    // Same payload → same fingerprint
    expect(id1).toBe(id2);
  });

  it("produces different fingerprints for different payloads", () => {
    const idA = linear.webhook.extractDeliveryId(new Headers(), { id: "a" });
    const idB = linear.webhook.extractDeliveryId(new Headers(), { id: "b" });
    expect(idA).not.toBe(idB);
  });

  it("fingerprint is a 32-char hex string", () => {
    const id = linear.webhook.extractDeliveryId(new Headers(), {
      type: "Issue",
    });
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});

// ── webhook.extractResourceId ─────────────────────────────────────────────────

describe("webhook.extractResourceId", () => {
  it("returns organizationId when present", () => {
    const payload = { organizationId: "org-abc" };
    expect(linear.webhook.extractResourceId(payload)).toBe("org-abc");
  });

  it("returns null when organizationId is absent", () => {
    expect(linear.webhook.extractResourceId({})).toBeNull();
  });
});

// ── resolveCategory ───────────────────────────────────────────────────────────

describe("resolveCategory", () => {
  it("strips action suffix to produce category", () => {
    expect(linear.resolveCategory("Issue:created")).toBe("Issue");
    expect(linear.resolveCategory("Comment:updated")).toBe("Comment");
  });

  it("returns eventType unchanged when no colon", () => {
    expect(linear.resolveCategory("Issue")).toBe("Issue");
  });
});

// ── webhook.extractSecret ─────────────────────────────────────────────────────

describe("webhook.extractSecret", () => {
  it("returns config.webhookSigningSecret", () => {
    expect(linear.webhook.extractSecret(testConfig)).toBe("lin_signing_secret");
  });
});

// ── webhook.parsePayload ──────────────────────────────────────────────────────

describe("webhook.parsePayload", () => {
  it("accepts any object payload (loose schema)", () => {
    const raw = { type: "Issue", action: "created", organizationId: "org-1" };
    expect(() => linear.webhook.parsePayload(raw)).not.toThrow();
  });
});
