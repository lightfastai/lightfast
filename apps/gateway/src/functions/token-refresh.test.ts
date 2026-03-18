import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Capture the cron handler passed to createFunction ──

let capturedHandler: (args: { step: any }) => Promise<unknown>;

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (
      config: { id: string },
      _trigger: unknown,
      handler: typeof capturedHandler
    ) => {
      if (config.id === "apps-gateway/token.refresh") {
        capturedHandler = handler;
      }
      return { id: config.id };
    },
  },
}));

// ── Mock externals ──

const mockDbSelect = vi.fn().mockResolvedValue([]);
const mockUpdateTokenRecord = vi.fn().mockResolvedValue(undefined);
const mockDecrypt = vi.fn().mockResolvedValue("decrypted-refresh-token");
const mockRefreshToken = vi.fn().mockResolvedValue({
  accessToken: "new-access-token",
  refreshToken: "new-refresh-token",
  expiresIn: 3600,
  tokenType: "bearer",
  raw: {},
});
const mockCreateConfig = vi.fn().mockReturnValue({ clientId: "test" });

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNotNull: vi.fn(),
  lt: vi.fn(),
}));

vi.mock("@db/console/client", () => ({
  db: {
    select: (..._args: unknown[]) => ({
      from: () => ({
        innerJoin: () => ({
          where: () => {
            const val = mockDbSelect();
            return {
              // biome-ignore lint/suspicious/noThenProperty: mock drizzle chain
              then: (res: (v: unknown) => void, rej: (e: unknown) => void) =>
                Promise.resolve(val).then(res, rej),
              catch: (rej: (e: unknown) => void) =>
                Promise.resolve(val).catch(rej),
            };
          },
        }),
      }),
    }),
  },
}));

vi.mock("@db/console/schema", () => ({
  gatewayInstallations: {
    id: "id",
    provider: "provider",
    externalId: "external_id",
    orgId: "org_id",
    status: "status",
  },
  gatewayTokens: {
    id: "id",
    installationId: "installation_id",
    accessToken: "access_token",
    refreshToken: "refresh_token",
    expiresAt: "expires_at",
  },
}));

vi.mock("@repo/console-providers", () => ({
  getProvider: (name: string) => {
    if (name === "github") {
      return {
        name: "github",
        auth: {
          kind: "oauth" as const,
          refreshToken: (...args: unknown[]) => mockRefreshToken(...args),
        },
      };
    }
    if (name === "api-key-provider") {
      return {
        name: "api-key-provider",
        auth: {
          kind: "api_key" as const,
        },
      };
    }
    return undefined;
  },
  PROVIDERS: {
    github: {
      createConfig: (...args: unknown[]) => mockCreateConfig(...args),
    },
    "api-key-provider": {
      createConfig: (...args: unknown[]) => mockCreateConfig(...args),
    },
  },
  PROVIDER_ENVS: () => [],
}));

vi.mock("@repo/lib", () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

vi.mock("../env", () => ({
  env: {
    ENCRYPTION_KEY: "a".repeat(64),
    GATEWAY_API_KEY: "test-key",
  },
}));

vi.mock("../lib/urls", () => ({
  gatewayBaseUrl: "https://gateway.test/services",
}));

vi.mock("../lib/encryption", () => ({
  getEncryptionKey: () => "a".repeat(64),
}));

vi.mock("../lib/token-store", () => ({
  updateTokenRecord: (...args: unknown[]) => mockUpdateTokenRecord(...args),
}));

// Force module load to capture handler
await import("./token-refresh.js");

// ── Helpers ──

function makeStep() {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
  };
}

function makeExpiringToken(overrides: Record<string, unknown> = {}) {
  return {
    installationId: "inst-1",
    tokenId: "tok-1",
    encryptedRefreshToken: "encrypted-refresh",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5min from now
    provider: "github",
    externalId: "ext-123",
    orgId: "org-1",
    ...overrides,
  };
}

// ── Tests ──

describe("tokenRefresh cron function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockResolvedValue([]);
    mockUpdateTokenRecord.mockResolvedValue(undefined);
    mockDecrypt.mockResolvedValue("decrypted-refresh-token");
    mockRefreshToken.mockResolvedValue({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      expiresIn: 3600,
      tokenType: "bearer",
      raw: {},
    });
    mockCreateConfig.mockReturnValue({ clientId: "test" });
  });

  it("refreshes an expiring token successfully", async () => {
    const token = makeExpiringToken();
    mockDbSelect.mockResolvedValueOnce([token]);

    const step = makeStep();
    const result = await capturedHandler({ step });

    expect(result).toEqual({ refreshed: 1 });
    expect(step.run).toHaveBeenCalledTimes(2); // list-expiring-tokens + refresh-inst-1
    expect(mockDecrypt).toHaveBeenCalledWith(
      "encrypted-refresh",
      expect.any(String)
    );
    expect(mockRefreshToken).toHaveBeenCalledWith(
      expect.anything(), // config
      "decrypted-refresh-token"
    );
    expect(mockUpdateTokenRecord).toHaveBeenCalledWith(
      "tok-1",
      expect.objectContaining({ accessToken: "new-access-token" }),
      "encrypted-refresh",
      token.expiresAt
    );
  });

  it("returns refreshed: 0 when no expiring tokens", async () => {
    mockDbSelect.mockResolvedValueOnce([]);

    const step = makeStep();
    const result = await capturedHandler({ step });

    expect(result).toEqual({ refreshed: 0 });
    expect(step.run).toHaveBeenCalledTimes(1); // list-expiring-tokens only
    expect(mockUpdateTokenRecord).not.toHaveBeenCalled();
  });

  it("logs warning but does not throw when refresh fails", async () => {
    const token = makeExpiringToken();
    mockDbSelect.mockResolvedValueOnce([token]);
    mockRefreshToken.mockRejectedValueOnce(new Error("refresh_failed"));

    const step = makeStep();
    // Should not throw
    const result = await capturedHandler({ step });

    // refreshedCount was not incremented because the refresh failed
    expect(result).toEqual({ refreshed: 0 });
    expect(mockUpdateTokenRecord).not.toHaveBeenCalled();
  });

  it("skips provider that does not support token refresh (non-oauth auth kind)", async () => {
    const token = makeExpiringToken({ provider: "api-key-provider" });
    mockDbSelect.mockResolvedValueOnce([token]);

    const step = makeStep();
    const result = await capturedHandler({ step });

    // The refresh step ran but returned early — no refresh call
    expect(result).toEqual({ refreshed: 0 });
    expect(mockRefreshToken).not.toHaveBeenCalled();
    expect(mockUpdateTokenRecord).not.toHaveBeenCalled();
  });

  it("does not query inactive installations (handled by SQL filter)", async () => {
    // The DB query filters status='active' AND refreshToken IS NOT NULL.
    // When no rows are returned, no refresh is attempted.
    mockDbSelect.mockResolvedValueOnce([]);

    const step = makeStep();
    const result = await capturedHandler({ step });

    expect(result).toEqual({ refreshed: 0 });
    expect(step.run).toHaveBeenCalledTimes(1); // only list-expiring-tokens
    expect(mockDecrypt).not.toHaveBeenCalled();
    expect(mockRefreshToken).not.toHaveBeenCalled();
    expect(mockUpdateTokenRecord).not.toHaveBeenCalled();
  });
});
