import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Capture workflow handler ──

let capturedHandler: (context: unknown) => Promise<void>;

vi.mock("@vendor/upstash-workflow/hono", () => ({
  serve: (handler: (ctx: unknown) => Promise<void>) => {
    capturedHandler = handler;
    return () => new Response("ok");
  },
}));

// ── Mock externals ──

const mockCancelBackfill = vi.fn().mockResolvedValue(undefined);
const mockGetProvider = vi.fn();
const mockDecrypt = vi.fn().mockResolvedValue("decrypted-token");
const mockRedisDel = vi.fn().mockResolvedValue(1);
const mockDbQuery = vi.fn().mockResolvedValue([]);
const mockDbUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock("../env", () => ({
  env: { ENCRYPTION_KEY: "a".repeat(64) },
}));

vi.mock("@vendor/upstash", () => ({
  redis: {
    del: (...args: unknown[]) => mockRedisDel(...args),
  },
}));

vi.mock("@db/console/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => {
          const result = mockDbQuery();
          (result as Record<string, unknown>).limit = () => result;
          return result;
        },
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => mockDbUpdate(),
      }),
    }),
  },
}));

vi.mock("@db/console/schema", () => ({
  gwInstallations: { id: "id", status: "status" },
  gwResources: {
    installationId: "installationId",
    providerResourceId: "providerResourceId",
    status: "status",
  },
  gwTokens: { installationId: "installationId", accessToken: "accessToken" },
}));

vi.mock("../lib/crypto", () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

vi.mock("../lib/cache", () => ({
  resourceKey: (provider: string, resourceId: string) =>
    `gw:resource:${provider}:${resourceId}`,
}));

vi.mock("../lib/urls", () => ({
  cancelBackfillService: (...args: unknown[]) => mockCancelBackfill(...args),
}));

vi.mock("../providers", () => ({
  getProvider: (...args: unknown[]) => mockGetProvider(...args),
}));

vi.mock("../providers/types", () => ({}));

// Force module load to trigger serve() and capture the handler
await import("./connection-teardown");

// ── Test helpers ──

function makeContext(payload: {
  installationId: string;
  provider: string;
  orgId: string;
}) {
  return {
    requestPayload: payload,
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
  };
}

function makeProvider(
  overrides: Partial<{
    name: string;
    requiresWebhookRegistration: boolean;
    revokeToken: ReturnType<typeof vi.fn>;
    deregisterWebhook: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    name: overrides.name ?? "github",
    requiresWebhookRegistration:
      overrides.requiresWebhookRegistration ?? false,
    revokeToken:
      overrides.revokeToken ?? vi.fn().mockResolvedValue(undefined),
    deregisterWebhook:
      overrides.deregisterWebhook ?? vi.fn().mockResolvedValue(undefined),
  };
}

// ── Tests ──

describe("connection-teardown workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQuery.mockResolvedValue([]);
    mockDbUpdate.mockResolvedValue(undefined);
    mockCancelBackfill.mockResolvedValue(undefined);
    mockDecrypt.mockResolvedValue("decrypted-token");
    mockRedisDel.mockResolvedValue(1);
  });

  it("runs all 5 steps for a full teardown", async () => {
    const provider = makeProvider({
      name: "linear",
      requiresWebhookRegistration: true,
    });
    mockGetProvider.mockReturnValue(provider);

    // Step 2: token row
    mockDbQuery.mockResolvedValueOnce([{ accessToken: "enc-tok" }]);
    // Step 3: installation with webhookId
    mockDbQuery.mockResolvedValueOnce([
      { id: "inst-1", metadata: { webhookId: "wh-1" } },
    ]);
    // Step 4: active resources
    mockDbQuery.mockResolvedValueOnce([
      { providerResourceId: "res-1" },
      { providerResourceId: "res-2" },
    ]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "linear",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(ctx.run).toHaveBeenCalledTimes(5);
    expect(mockCancelBackfill).toHaveBeenCalledWith({
      installationId: "inst-1",
    });
    expect(mockDecrypt).toHaveBeenCalled();
    expect(provider.revokeToken).toHaveBeenCalledWith("decrypted-token");
    expect(provider.deregisterWebhook).toHaveBeenCalledWith("inst-1", "wh-1");
    expect(mockRedisDel).toHaveBeenCalledTimes(2);
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it("calls cancelBackfillService in step 1", async () => {
    mockGetProvider.mockReturnValue(makeProvider());

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(mockCancelBackfill).toHaveBeenCalledWith({
      installationId: "inst-1",
    });
  });

  it("skips token revocation for github provider", async () => {
    const provider = makeProvider({ name: "github" });
    mockGetProvider.mockReturnValue(provider);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(mockDecrypt).not.toHaveBeenCalled();
    expect(provider.revokeToken).not.toHaveBeenCalled();
  });

  it("revokes token for non-github provider when token exists", async () => {
    const provider = makeProvider({ name: "vercel" });
    mockGetProvider.mockReturnValue(provider);

    // Step 2: token row
    mockDbQuery.mockResolvedValueOnce([{ accessToken: "enc-tok" }]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "vercel",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(mockDecrypt).toHaveBeenCalled();
    expect(provider.revokeToken).toHaveBeenCalledWith("decrypted-token");
  });

  it("skips revocation when no token row found", async () => {
    const provider = makeProvider({ name: "vercel" });
    mockGetProvider.mockReturnValue(provider);

    // Step 2: no token rows
    mockDbQuery.mockResolvedValueOnce([]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "vercel",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(provider.revokeToken).not.toHaveBeenCalled();
  });

  it("swallows revokeToken errors (best-effort)", async () => {
    const provider = makeProvider({
      name: "sentry",
      revokeToken: vi.fn().mockRejectedValue(new Error("revoke failed")),
    });
    mockGetProvider.mockReturnValue(provider);

    // Step 2: token row
    mockDbQuery.mockResolvedValueOnce([{ accessToken: "enc-tok" }]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "sentry",
      orgId: "org-1",
    });

    // Should not throw
    await expect(capturedHandler(ctx)).resolves.toBeUndefined();
    expect(provider.revokeToken).toHaveBeenCalled();
  });

  it("skips webhook deregistration for providers that don't require it", async () => {
    const provider = makeProvider({
      name: "vercel",
      requiresWebhookRegistration: false,
    });
    mockGetProvider.mockReturnValue(provider);

    // Step 2: token row
    mockDbQuery.mockResolvedValueOnce([{ accessToken: "enc-tok" }]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "vercel",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(provider.deregisterWebhook).not.toHaveBeenCalled();
  });

  it("skips webhook deregistration when no webhookId in metadata", async () => {
    const provider = makeProvider({
      name: "linear",
      requiresWebhookRegistration: true,
    });
    mockGetProvider.mockReturnValue(provider);

    // Step 2: no token
    mockDbQuery.mockResolvedValueOnce([]);
    // Step 3: installation with null metadata
    mockDbQuery.mockResolvedValueOnce([{ id: "inst-1", metadata: null }]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "linear",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(provider.deregisterWebhook).not.toHaveBeenCalled();
  });

  it("swallows deregisterWebhook errors (best-effort)", async () => {
    const provider = makeProvider({
      name: "sentry",
      requiresWebhookRegistration: true,
      deregisterWebhook: vi
        .fn()
        .mockRejectedValue(new Error("deregister failed")),
    });
    mockGetProvider.mockReturnValue(provider);

    // Step 2: no token
    mockDbQuery.mockResolvedValueOnce([]);
    // Step 3: installation with webhookId
    mockDbQuery.mockResolvedValueOnce([
      { id: "inst-1", metadata: { webhookId: "wh-1" } },
    ]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "sentry",
      orgId: "org-1",
    });

    await expect(capturedHandler(ctx)).resolves.toBeUndefined();
    expect(provider.deregisterWebhook).toHaveBeenCalled();
  });

  it("cleans up Redis cache for all active resources", async () => {
    mockGetProvider.mockReturnValue(makeProvider({ name: "github" }));

    // Step 4: 3 active resources (github skips steps 2 & 3 DB calls)
    mockDbQuery.mockResolvedValueOnce([
      { providerResourceId: "repo-a" },
      { providerResourceId: "repo-b" },
      { providerResourceId: "repo-c" },
    ]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(mockRedisDel).toHaveBeenCalledTimes(3);
    expect(mockRedisDel).toHaveBeenCalledWith("gw:resource:github:repo-a");
    expect(mockRedisDel).toHaveBeenCalledWith("gw:resource:github:repo-b");
    expect(mockRedisDel).toHaveBeenCalledWith("gw:resource:github:repo-c");
  });

  it("handles zero active resources gracefully", async () => {
    mockGetProvider.mockReturnValue(makeProvider({ name: "github" }));

    // Step 4: no resources
    mockDbQuery.mockResolvedValueOnce([]);

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    expect(mockRedisDel).not.toHaveBeenCalled();
  });

  it("soft-deletes installation and resources in DB", async () => {
    mockGetProvider.mockReturnValue(makeProvider({ name: "github" }));

    const ctx = makeContext({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
    });
    await capturedHandler(ctx);

    // Two db.update calls: installation status → 'revoked', resources → 'removed'
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });
});
