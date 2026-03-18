import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Capture the cron handler passed to createFunction ──

let capturedHandler: (args: { step: any }) => Promise<unknown>;

const mockInngestSend = vi.fn().mockResolvedValue(undefined);

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (
      config: { id: string },
      _trigger: unknown,
      handler: typeof capturedHandler
    ) => {
      if (config.id === "apps-gateway/health.check") {
        capturedHandler = handler;
      }
      return { id: config.id };
    },
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
}));

// ── Mock externals ──

const mockDbSelect = vi.fn().mockResolvedValue([]);
const mockDbUpdate = vi.fn().mockResolvedValue(undefined);
const mockDbInsert = vi.fn().mockResolvedValue(undefined);
const mockDbInsertValues = vi.fn();
const mockDbUpdateSet = vi.fn();

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: vi.fn().mockReturnValue("SQL_EXPRESSION"),
}));

vi.mock("@db/console/client", () => ({
  db: {
    select: (..._args: unknown[]) => ({
      from: () => ({
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
    update: () => ({
      set: (...args: unknown[]) => {
        mockDbUpdateSet(...args);
        return { where: () => mockDbUpdate() };
      },
    }),
    insert: () => ({
      values: (...args: unknown[]) => {
        mockDbInsertValues(...args);
        return mockDbInsert();
      },
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
    healthStatus: "health_status",
    healthCheckFailures: "health_check_failures",
    lastHealthCheckAt: "last_health_check_at",
  },
  gatewayLifecycleLogs: {
    id: "id",
    installationId: "installation_id",
    event: "event",
    fromStatus: "from_status",
    toStatus: "to_status",
    reason: "reason",
    metadata: "metadata",
  },
}));

const mockHealthCheck = vi.fn();
const mockCreateConfig = vi.fn().mockReturnValue({ clientId: "test" });
const mockGetActiveTokenForInstallation = vi
  .fn()
  .mockResolvedValue({ token: "test-token", expiresAt: null });

vi.mock("@repo/console-providers", () => ({
  getProvider: (name: string) => {
    if (name === "github") {
      return {
        name: "github",
        auth: { kind: "oauth" as const },
        healthCheck: {
          check: (...args: unknown[]) => mockHealthCheck(...args),
        },
      };
    }
    if (name === "no-health-check") {
      return {
        name: "no-health-check",
        auth: { kind: "oauth" as const },
        // No healthCheck defined
      };
    }
    return undefined;
  },
  PROVIDERS: {
    github: {
      createConfig: (...args: unknown[]) => mockCreateConfig(...args),
    },
    "no-health-check": {
      createConfig: (...args: unknown[]) => mockCreateConfig(...args),
    },
    "unconfigured-provider": {
      createConfig: () => null,
    },
  },
  PROVIDER_ENVS: () => [],
}));

vi.mock("@repo/lib", () => ({
  nanoid: vi.fn().mockReturnValue("mock-id"),
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

vi.mock("../lib/token-helpers", () => ({
  getActiveTokenForInstallation: (...args: unknown[]) =>
    mockGetActiveTokenForInstallation(...args),
}));

// Force module load to capture handler
await import("./health-check.js");

// ── Helpers ──

function makeStep() {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
  };
}

function makeInstallation(overrides: Record<string, unknown> = {}) {
  return {
    id: "inst-1",
    provider: "github",
    externalId: "ext-123",
    orgId: "org-1",
    healthCheckFailures: 0,
    ...overrides,
  };
}

// ── Tests ──

describe("healthCheck cron function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockResolvedValue([]);
    mockDbUpdate.mockResolvedValue(undefined);
    mockDbInsert.mockResolvedValue(undefined);
    mockHealthCheck.mockResolvedValue("healthy");
    mockCreateConfig.mockReturnValue({ clientId: "test" });
    mockGetActiveTokenForInstallation.mockResolvedValue({
      token: "test-token",
      expiresAt: null,
    });
    mockInngestSend.mockResolvedValue(undefined);
  });

  it("updates healthStatus to 'healthy' and resets failures on healthy probe", async () => {
    const installation = makeInstallation({ healthCheckFailures: 2 });
    mockDbSelect.mockResolvedValueOnce([installation]);
    mockHealthCheck.mockResolvedValueOnce("healthy");

    const step = makeStep();
    const result = await capturedHandler({ step });

    expect(result).toEqual({ probed: 1 });
    // The probe step should have been called
    expect(step.run).toHaveBeenCalledTimes(2); // list-active-installations + probe-inst-1
    // DB update should set healthy status
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        healthStatus: "healthy",
        healthCheckFailures: 0,
      })
    );
    // No lifecycle event should be fired
    expect(mockInngestSend).not.toHaveBeenCalled();
    // No lifecycle log inserted
    expect(mockDbInsertValues).not.toHaveBeenCalled();
  });

  it("fires lifecycle event on auth failure (revoked)", async () => {
    const installation = makeInstallation();
    mockDbSelect.mockResolvedValueOnce([installation]);
    mockHealthCheck.mockResolvedValueOnce("revoked");

    const step = makeStep();
    await capturedHandler({ step });

    // Lifecycle log should be inserted
    expect(mockDbInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        installationId: "inst-1",
        event: "health_check_revoked",
        fromStatus: "active",
        toStatus: "revoked",
      })
    );
    // Lifecycle event should be sent
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "platform/connection.lifecycle",
        data: expect.objectContaining({
          reason: "health_check_revoked",
          installationId: "inst-1",
          orgId: "org-1",
          provider: "github",
          triggeredBy: "health_check",
        }),
      })
    );
  });

  it("skips installations whose provider has no healthCheck", async () => {
    const installation = makeInstallation({ provider: "no-health-check" });
    mockDbSelect.mockResolvedValueOnce([installation]);

    const step = makeStep();
    const result = await capturedHandler({ step });

    expect(result).toEqual({ probed: 1 });
    // Only the list step should run — no probe step for this installation
    expect(step.run).toHaveBeenCalledTimes(1); // list-active-installations only
    expect(mockHealthCheck).not.toHaveBeenCalled();
    expect(mockDbUpdateSet).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("records transient failure when token fetch fails", async () => {
    const installation = makeInstallation({ healthCheckFailures: 0 });
    mockDbSelect.mockResolvedValueOnce([installation]);
    mockGetActiveTokenForInstallation.mockRejectedValueOnce(
      new Error("token_expired")
    );

    const step = makeStep();
    await capturedHandler({ step });

    // DB should be updated with incremented failures
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        healthStatus: "unknown",
      })
    );
    // No lifecycle event for first failure
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("marks degraded after 3+ consecutive failures", async () => {
    const installation = makeInstallation({ healthCheckFailures: 2 });
    mockDbSelect.mockResolvedValueOnce([installation]);
    mockGetActiveTokenForInstallation.mockRejectedValueOnce(
      new Error("network_error")
    );

    const step = makeStep();
    await capturedHandler({ step });

    // healthCheckFailures was 2, so newFailureCount = 3 -> degraded
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        healthStatus: "degraded",
      })
    );
    // Still below lifecycle threshold (6), no event
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("fires lifecycle event after 6+ consecutive failures", async () => {
    const installation = makeInstallation({ healthCheckFailures: 5 });
    mockDbSelect.mockResolvedValueOnce([installation]);
    mockHealthCheck.mockImplementationOnce(() => {
      throw new Error("network timeout");
    });

    const step = makeStep();
    await capturedHandler({ step });

    // healthCheckFailures was 5, so newFailureCount = 6 -> lifecycle
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        healthStatus: "degraded",
      })
    );
    // Lifecycle log should be inserted
    expect(mockDbInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        installationId: "inst-1",
        event: "health_check_unreachable",
        fromStatus: "active",
        toStatus: "revoked",
      })
    );
    // Lifecycle event should be sent
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "platform/connection.lifecycle",
        data: expect.objectContaining({
          reason: "health_check_unreachable",
          installationId: "inst-1",
          triggeredBy: "health_check",
        }),
      })
    );
  });

  it("skips with warning log when provider is not configured", async () => {
    const installation = makeInstallation({
      provider: "github",
    });
    mockDbSelect.mockResolvedValueOnce([installation]);
    mockCreateConfig.mockReturnValueOnce(null); // provider not configured

    const step = makeStep();
    await capturedHandler({ step });

    // Probe step ran but returned early — no DB update, no lifecycle
    expect(mockHealthCheck).not.toHaveBeenCalled();
    expect(mockDbUpdateSet).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });
});
