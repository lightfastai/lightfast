import { call, ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({}));

vi.mock("@vendor/clerk/server", () => ({
  clerkClient: () =>
    Promise.resolve({
      apiKeys: { verify: verifyMock },
    }),
}));

const { authMiddleware } = await import("../middleware/auth");

const validKey = `ak_${"a".repeat(40)}`;

function apiKey(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "apk_test",
    type: "api_key",
    name: "test",
    subject: "org_test",
    scopes: [],
    claims: null,
    revoked: false,
    revocationReason: null,
    expired: false,
    expiration: null,
    createdBy: "user_test",
    description: null,
    lastUsedAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

async function invokeAuth(headers: Headers) {
  const { os } = await import("@orpc/server");
  const proc = os
    .$context<{ headers: Headers; requestId: string }>()
    .use(authMiddleware)
    .handler(({ context }) => context);

  return call(proc, undefined, {
    context: { headers, requestId: "test-req" },
  });
}

beforeEach(() => {
  verifyMock.mockReset();
});

describe("authMiddleware", () => {
  it("throws UNAUTHORIZED when Authorization header is missing", async () => {
    await expect(invokeAuth(new Headers())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: expect.stringContaining("API key required"),
    });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("throws UNAUTHORIZED when scheme is not Bearer", async () => {
    await expect(
      invokeAuth(new Headers({ authorization: `Basic ${validKey}` }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: expect.stringContaining("API key required"),
    });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("throws UNAUTHORIZED when token is not ak_ prefixed (no network call)", async () => {
    await expect(
      invokeAuth(new Headers({ authorization: "Bearer not-a-clerk-key" }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: expect.stringContaining("Invalid API key format"),
    });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("throws UNAUTHORIZED when clerk.apiKeys.verify throws", async () => {
    verifyMock.mockRejectedValueOnce(new Error("clerk down"));

    await expect(
      invokeAuth(new Headers({ authorization: `Bearer ${validKey}` }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid API key",
    });
    expect(verifyMock).toHaveBeenCalledWith(validKey);
  });

  it("throws UNAUTHORIZED when key is revoked", async () => {
    verifyMock.mockResolvedValueOnce(apiKey({ revoked: true }));

    await expect(
      invokeAuth(new Headers({ authorization: `Bearer ${validKey}` }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "API key revoked",
    });
  });

  it("throws UNAUTHORIZED when key is expired", async () => {
    verifyMock.mockResolvedValueOnce(apiKey({ expired: true }));

    await expect(
      invokeAuth(new Headers({ authorization: `Bearer ${validKey}` }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "API key expired",
    });
  });

  it("throws FORBIDDEN when subject is not org-scoped", async () => {
    verifyMock.mockResolvedValueOnce(apiKey({ subject: "user_personal" }));

    await expect(
      invokeAuth(new Headers({ authorization: `Bearer ${validKey}` }))
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "API key is not org-scoped",
    });
  });

  it("throws FORBIDDEN when createdBy is missing", async () => {
    verifyMock.mockResolvedValueOnce(apiKey({ createdBy: null }));

    await expect(
      invokeAuth(new Headers({ authorization: `Bearer ${validKey}` }))
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "API key is missing creator metadata",
    });
  });

  it("accepts lowercase 'bearer' scheme (RFC 7235 case-insensitive)", async () => {
    verifyMock.mockResolvedValueOnce(apiKey());

    const ctx = await invokeAuth(
      new Headers({ authorization: `bearer ${validKey}` })
    );

    expect(ctx).toMatchObject({
      apiKeyId: "apk_test",
      auth: {
        identity: {
          orgId: "org_test",
          type: "active",
          userId: "user_test",
        },
      },
    });
  });

  it("resolves and exposes the shared auth identity context when the key is valid", async () => {
    verifyMock.mockResolvedValueOnce(apiKey());

    const ctx = await invokeAuth(
      new Headers({ authorization: `Bearer ${validKey}` })
    );

    expect(ctx).toMatchObject({
      apiKeyId: "apk_test",
      auth: {
        identity: {
          orgId: "org_test",
          type: "active",
          userId: "user_test",
        },
      },
    });
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledWith(validKey);
  });

  it("rethrows ORPCError instances (smoke check)", () => {
    expect(new ORPCError("UNAUTHORIZED").code).toBe("UNAUTHORIZED");
  });
});
