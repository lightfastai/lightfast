import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Capture workflow handler ──

let capturedHandler: (context: unknown) => Promise<void> = () => {
  throw new Error(
    "serve() was never called — connection-teardown module failed to register its handler"
  );
};

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: (handler: (ctx: unknown) => Promise<void>) => {
    capturedHandler = handler;
    return () => new Response("ok");
  },
}));

// ── Mock externals ──

const mockPublishJSON = vi.fn().mockResolvedValue(undefined);
const mockRevokeToken = vi.fn().mockResolvedValue(undefined);
const mockDecrypt = vi.fn().mockResolvedValue("decrypted-token");
const mockRedisDel = vi.fn().mockResolvedValue(1);
const mockDbQuery = vi.fn().mockResolvedValue([]);
const mockDbUpdate = vi.fn().mockResolvedValue(undefined);
const mockDbInsert = vi.fn().mockResolvedValue(undefined);
const mockDbInsertValues = vi.fn();
const mockTxSet = vi.fn();

// eq/and are intentionally no-op — these tests validate workflow step
// orchestration, not SQL predicate correctness. The db mock's .where()
// ignores its arguments, so strict WHERE validation is not required.
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock("../env", () => ({
  env: {
    ENCRYPTION_KEY: "a".repeat(64),
    GATEWAY_API_KEY: "test-key",
    VERCEL_INTEGRATION_SLUG: "test-slug",
    VERCEL_CLIENT_SECRET_ID: "test-id",
    VERCEL_CLIENT_INTEGRATION_SECRET: "test-secret",
    LINEAR_CLIENT_ID: "lin-id",
    LINEAR_CLIENT_SECRET: "lin-secret",
    LINEAR_WEBHOOK_SIGNING_SECRET: "lin-webhook-secret",
    SENTRY_APP_SLUG: "sen-slug",
    SENTRY_CLIENT_ID: "sen-id",
    SENTRY_CLIENT_SECRET: "sen-secret",
  },
}));

vi.mock("../lib/urls", () => ({
  gatewayBaseUrl: "https://gateway.test/services",
}));

vi.mock("@vendor/upstash", () => ({
  redis: {
    del: (...args: unknown[]) => mockRedisDel(...args),
  },
}));

vi.mock("@db/console/client", () => ({
  db: {
    select: () => {
      const builder = {
        from: () => builder,
        where: () => builder,
        limit: () => builder,
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Drizzle query builder
        then: (
          resolve: (v: unknown) => unknown,
          reject: (e: unknown) => unknown
        ) => mockDbQuery().then(resolve, reject),
      };
      return builder;
    },
    update: () => ({
      set: (...args: unknown[]) => {
        mockTxSet(...args);
        return { where: () => mockDbUpdate() };
      },
    }),
    insert: () => ({
      values: (...args: unknown[]) => {
        mockDbInsertValues(...args);
        return mockDbInsert();
      },
    }),
    batch: (queries: unknown[]) => Promise.all(queries as Promise<unknown>[]),
  },
}));

vi.mock("@db/console/schema", () => ({
  gatewayInstallations: { id: "id", status: "status" },
  gatewayLifecycleLogs: {},
  gatewayResources: {
    installationId: "installationId",
    providerResourceId: "providerResourceId",
    status: "status",
  },
  gatewayTokens: {
    installationId: "installationId",
    accessToken: "accessToken",
  },
}));

vi.mock("@repo/lib", () => ({
  nanoid: vi.fn().mockReturnValue("mock-id"),
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
  encrypt: vi.fn().mockResolvedValue("encrypted-value"),
}));

vi.mock("../lib/cache", () => ({
  resourceKey: (provider: string, resourceId: string) =>
    `gw:resource:${provider}:${resourceId}`,
}));

vi.mock("@repo/gateway-service-clients", () => ({
  backfillUrl: "https://backfill.test/api",
}));

vi.mock("@vendor/qstash", () => ({
  getQStashClient: () => ({
    publishJSON: (...args: unknown[]) => mockPublishJSON(...args),
  }),
}));

vi.mock("@repo/console-providers", () => ({
  PROVIDERS: {
    github: {
      createConfig: vi.fn().mockReturnValue({}),
      auth: {
        kind: "oauth",
        revokeToken: (...args: unknown[]) => mockRevokeToken(...args),
      },
    },
    vercel: {
      createConfig: vi.fn().mockReturnValue({}),
      auth: {
        kind: "oauth",
        revokeToken: (...args: unknown[]) => mockRevokeToken(...args),
      },
    },
    linear: {
      createConfig: vi.fn().mockReturnValue({}),
      auth: {
        kind: "oauth",
        revokeToken: (...args: unknown[]) => mockRevokeToken(...args),
      },
    },
    sentry: {
      createConfig: vi.fn().mockReturnValue({}),
      auth: {
        kind: "oauth",
        revokeToken: (...args: unknown[]) => mockRevokeToken(...args),
      },
    },
  },
  PROVIDER_ENVS: () => [],
  getProvider: (name: string) => {
    const known = ["github", "vercel", "linear", "sentry"];
    if (!known.includes(name)) {
      return undefined;
    }
    return {
      createConfig: vi.fn().mockReturnValue({}),
      auth: {
        kind: "oauth",
        revokeToken: (...args: unknown[]) => mockRevokeToken(...args),
      },
    };
  },
}));

// Force module load to trigger serve() and capture the handler
await import("./connection-teardown.js");

// ── Test helpers ──

function makeContext(payload: {
  installationId: string;
  provider: string;
  orgId: string;
}) {
  return {
    requestPayload: payload,
    run: vi.fn(async (_name: string, fn: () => unknown) => fn()),
  };
}

// ── Tests ──

describe("connection-teardown workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQuery.mockResolvedValue([]);
    mockDbUpdate.mockResolvedValue(undefined);
    mockDbInsert.mockResolvedValue(undefined);
    mockDbInsertValues.mockClear();
    mockTxSet.mockClear();
    mockPublishJSON.mockResolvedValue(undefined);
    mockDecrypt.mockResolvedValue("decrypted-token");
    mockRedisDel.mockResolvedValue(1);
    mockRevokeToken.mockResolvedValue(undefined);
  });

  it("runs all 5 steps for a full teardown", async () => {
    const resources = [
      { providerResourceId: "res-1" },
      { providerResourceId: "res-2" },
    ];
    // Step 3: token row (for non-github)
    mockDbQuery.mockResolvedValueOnce([{ accessToken: "enc-tok" }]);
    // Step 4: active resources (cleanup-cache)
    mockDbQuery.mockResolvedValueOnce(resources);
    // Step 5: active resources (remove-resources audit log query)
    mockDbQuery.mockResolvedValueOnce(resources);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "linear",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(ctx.run).toHaveBeenCalledTimes(5);
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://backfill.test/api/trigger/cancel",
        body: { installationId: "inst-1" },
      })
    );
    expect(mockDecrypt).toHaveBeenCalled();
    expect(mockRevokeToken).toHaveBeenCalledWith(
      expect.anything(),
      "decrypted-token"
    );
    expect(mockRedisDel).toHaveBeenCalledTimes(1);
    expect(mockRedisDel).toHaveBeenCalledWith(
      "gw:resource:linear:res-1",
      "gw:resource:linear:res-2"
    );
    // 2 db.update calls: close-gate (installation) + remove-resources (resources)
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
    // 2 db.insert calls: close-gate audit log + remove-resources audit log
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
  });

  it("close-gate runs before cancel-backfill", async () => {
    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(ctx.run.mock.calls[0]![0]).toBe("close-gate");
    expect(ctx.run.mock.calls[1]![0]).toBe("cancel-backfill");
  });

  it("publishes backfill cancel via QStash in step 2", async () => {
    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://backfill.test/api/trigger/cancel",
        body: { installationId: "inst-1" },
        retries: 3,
        deduplicationId: "backfill-cancel:inst-1",
      })
    );
  });

  it("skips token revocation for github provider", async () => {
    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(mockDecrypt).not.toHaveBeenCalled();
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  it("revokes token for non-github provider when token exists", async () => {
    // Step 3: token row
    mockDbQuery.mockResolvedValueOnce([{ accessToken: "enc-tok" }]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "vercel",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(mockDecrypt).toHaveBeenCalled();
    expect(mockRevokeToken).toHaveBeenCalledWith(
      expect.anything(),
      "decrypted-token"
    );
  });

  it("skips revocation when no token row found", async () => {
    // Step 3: no token rows
    mockDbQuery.mockResolvedValueOnce([]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "vercel",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  it("swallows revokeToken errors (best-effort)", async () => {
    mockRevokeToken.mockRejectedValueOnce(new Error("revoke failed"));

    // Step 3: token row
    mockDbQuery.mockResolvedValueOnce([{ accessToken: "enc-tok" }]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "sentry",
      orgId: "org-1",
    });

    // Should not throw
    await expect(capturedHandler(ctx)).resolves.toBeUndefined();
    expect(mockRevokeToken).toHaveBeenCalled();
  });

  it("cleans up Redis cache for all active resources", async () => {
    const resources = [
      { providerResourceId: "repo-a" },
      { providerResourceId: "repo-b" },
      { providerResourceId: "repo-c" },
    ];
    // Step 4: 3 active resources (github skips step 3 DB call)
    mockDbQuery.mockResolvedValueOnce(resources);
    // Step 5: same resources for remove-resources audit log query
    mockDbQuery.mockResolvedValueOnce(resources);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(mockRedisDel).toHaveBeenCalledTimes(1);
    expect(mockRedisDel).toHaveBeenCalledWith(
      "gw:resource:github:repo-a",
      "gw:resource:github:repo-b",
      "gw:resource:github:repo-c"
    );
  });

  it("handles zero active resources gracefully", async () => {
    // Step 4: no resources (cleanup-cache)
    mockDbQuery.mockResolvedValueOnce([]);
    // Step 5: no resources (remove-resources audit log query)
    mockDbQuery.mockResolvedValueOnce([]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(mockRedisDel).not.toHaveBeenCalled();
  });

  it("close-gate sets installation status to revoked", async () => {
    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    // close-gate is the first db.update call
    expect(mockTxSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "revoked" })
    );
  });

  it("remove-resources sets resources status to removed", async () => {
    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    // remove-resources is the second db.update call
    expect(mockTxSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "removed" })
    );
  });

  it("uses separate db.update calls instead of db.batch", async () => {
    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    // 2 individual db.update calls: close-gate + remove-resources
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
    expect(mockTxSet).toHaveBeenCalledTimes(2);
  });

  // ── Audit log tests ──

  it("close-gate step inserts audit log with event gate_closed", async () => {
    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    // First db.insert call is from close-gate step
    expect(mockDbInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        installationId: "inst-1",
        event: "gate_closed",
        fromStatus: "active",
        toStatus: "revoked",
        metadata: expect.objectContaining({
          step: "close-gate",
          triggeredBy: "system",
        }),
      })
    );
  });

  it("remove-resources step inserts audit log with event resources_removed", async () => {
    const resources = [
      { providerResourceId: "repo-a" },
      { providerResourceId: "repo-b" },
    ];
    // Step 4: active resources (cleanup-cache)
    mockDbQuery.mockResolvedValueOnce(resources);
    // Step 5: active resources (remove-resources audit log query)
    mockDbQuery.mockResolvedValueOnce(resources);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(mockDbInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        installationId: "inst-1",
        event: "resources_removed",
        fromStatus: "revoked",
        toStatus: "revoked",
        resourceIds: { "repo-a": "removed", "repo-b": "removed" },
        metadata: expect.objectContaining({
          step: "remove-resources",
          triggeredBy: "system",
        }),
      })
    );
  });

  it("remove-resources audit log includes empty resourceIds when no resources", async () => {
    // Step 4: no resources (cleanup-cache)
    mockDbQuery.mockResolvedValueOnce([]);
    // Step 5: no resources (remove-resources audit log query)
    mockDbQuery.mockResolvedValueOnce([]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(mockDbInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "resources_removed",
        resourceIds: {},
        reason: "Removed 0 linked resource(s) during teardown",
      })
    );
  });

  it("inserts exactly 2 audit log rows per teardown", async () => {
    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    // close-gate + remove-resources
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
    expect(mockDbInsertValues).toHaveBeenCalledTimes(2);
  });
});
