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
import type { HmacScheme } from "../../provider/webhook";
import { computeHmac } from "../../runtime/crypto";
import { deriveVerifySignature } from "../../runtime/verify/index";
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

// ── auth kind ─────────────────────────────────────────────────────────────────

describe("auth.kind", () => {
  it("is 'app-token' — GitHub uses app-level credentials, not per-user OAuth", () => {
    expect(github.auth.kind).toBe("app-token");
  });

  it("usesStoredToken is false — tokens are generated on demand", () => {
    expect(github.auth.usesStoredToken).toBe(false);
  });
});

// ── auth.buildInstallUrl ───────────────────────────────────────────────────────

describe("auth.buildInstallUrl", () => {
  // Narrow via kind to access app-token-specific method
  const appTokenAuth = github.auth.kind === "app-token" ? github.auth : null;

  it("is an app-token provider", () => {
    expect(appTokenAuth).not.toBeNull();
  });

  it("builds correct GitHub App installation URL with appSlug", () => {
    const config: GitHubConfig = { ...testConfig, appSlug: "my-github-app" };
    const url = appTokenAuth!.buildInstallUrl(config, "state-abc");
    expect(url).toContain(
      "https://github.com/apps/my-github-app/installations/new"
    );
  });

  it("embeds state as a query parameter", () => {
    const url = appTokenAuth!.buildInstallUrl(testConfig, "my-state-value");
    expect(url).toContain("state=my-state-value");
  });

  it("returns a string", () => {
    expect(typeof appTokenAuth!.buildInstallUrl(testConfig, "s")).toBe(
      "string"
    );
  });
});

// ── auth.revokeAccess ─────────────────────────────────────────────────────────

describe("auth.revokeAccess", () => {
  const appTokenAuth = github.auth.kind === "app-token" ? github.auth : null;

  it("calls DELETE to the GitHub app installations endpoint", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await expect(
      appTokenAuth?.revokeAccess?.(testConfig, "12345")
    ).resolves.toBeUndefined();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://api.github.com/app/installations/12345");
    expect(init.method).toBe("DELETE");
  });

  it("accepts 404 as success — installation already uninstalled", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(
      appTokenAuth?.revokeAccess?.(testConfig, "12345")
    ).resolves.toBeUndefined();
  });

  it("throws on other HTTP errors", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(
      appTokenAuth?.revokeAccess?.(testConfig, "12345")
    ).rejects.toThrow("GitHub installation revocation failed: 500");
  });

  it("uses Bearer JWT auth header", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await appTokenAuth?.revokeAccess?.(testConfig, "12345");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const authHeader =
      (init.headers as Record<string, string>).Authorization ?? "";
    expect(authHeader).toMatch(/^Bearer /);
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

// ── webhook.signatureScheme + deriveVerifySignature ───────────────────────────

describe("webhook.signatureScheme", () => {
  it("has signatureScheme with hmac kind", () => {
    expect(github.webhook.signatureScheme.kind).toBe("hmac");
  });

  it("uses sha256 algorithm", () => {
    expect((github.webhook.signatureScheme as HmacScheme).algorithm).toBe(
      "sha256"
    );
  });

  it("uses x-hub-signature-256 header", () => {
    expect(github.webhook.signatureScheme.signatureHeader).toBe(
      "x-hub-signature-256"
    );
  });

  it("has sha256= prefix", () => {
    expect((github.webhook.signatureScheme as HmacScheme).prefix).toBe(
      "sha256="
    );
  });
});

describe("deriveVerifySignature(github.webhook.signatureScheme)", () => {
  const secret = "webhook-secret";
  const body = '{"action":"push","ref":"refs/heads/main"}';
  const verify = deriveVerifySignature(github.webhook.signatureScheme);

  it("returns false when x-hub-signature-256 header is absent", () => {
    expect(verify(body, new Headers(), secret)).toBe(false);
  });

  it("returns false for an incorrect signature", () => {
    const headers = new Headers({ "x-hub-signature-256": "sha256=000000" });
    expect(verify(body, headers, secret)).toBe(false);
  });

  it("returns true for a valid signature with sha256= prefix", () => {
    const expected = computeHmac(body, secret, "SHA-256");
    const headers = new Headers({
      "x-hub-signature-256": `sha256=${expected}`,
    });
    expect(verify(body, headers, secret)).toBe(true);
  });

  it("returns false for a valid signature without sha256= prefix (prefix required)", () => {
    const expected = computeHmac(body, secret, "SHA-256");
    const headers = new Headers({ "x-hub-signature-256": expected });
    expect(verify(body, headers, secret)).toBe(false);
  });

  it("returns false for signature computed with wrong secret", () => {
    const wrongSig = computeHmac(body, "wrong-secret", "SHA-256");
    const headers = new Headers({
      "x-hub-signature-256": `sha256=${wrongSig}`,
    });
    expect(verify(body, headers, secret)).toBe(false);
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

// ── healthCheck.check ─────────────────────────────────────────────────────────

describe("healthCheck.check", () => {
  it("returns 'healthy' when GitHub returns 200", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await github.healthCheck!.check(testConfig, "12345", null);
    expect(result).toBe("healthy");
  });

  it("returns 'revoked' when GitHub returns 404 (installation uninstalled)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await github.healthCheck!.check(testConfig, "12345", null);
    expect(result).toBe("revoked");
  });

  it("throws on unexpected HTTP status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(
      github.healthCheck!.check(testConfig, "12345", null)
    ).rejects.toThrow("GitHub health check failed: 500");
  });

  it("calls GET /app/installations/{externalId} with App JWT auth", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await github.healthCheck!.check(testConfig, "99999", null);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/app/installations/99999");
    expect(init.method).toBe("GET");
    const authHeader =
      (init.headers as Record<string, string>).Authorization ?? "";
    expect(authHeader).toMatch(/^Bearer /);
  });

  it("ignores accessToken param — uses App JWT", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    // accessToken is null for GitHub app-token providers
    const result = await github.healthCheck!.check(testConfig, "12345", null);
    expect(result).toBe("healthy");
  });
});
