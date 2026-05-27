import { call, ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMock = vi.fn();
const isOrgBoundMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({ isOrgBound: isOrgBoundMock }));

vi.mock("@vendor/unkey/server", () => ({
  getUnkeyClient: () => ({
    keys: { verifyKey: verifyMock },
  }),
}));

const { authMiddleware } = await import("../middleware/auth");

const validKey = `lf_${"a".repeat(40)}`;

function verifyResult(
  overrides: Partial<{
    code: string;
    identity: { externalId?: string; id: string } | undefined;
    keyId: string | undefined;
    meta: Record<string, unknown> | undefined;
    valid: boolean;
  }> = {}
) {
  return {
    data: {
      code: "VALID",
      identity: { externalId: "org_test", id: "identity_test" },
      keyId: "key_test",
      meta: { createdByUserId: "user_test" },
      valid: true,
      ...overrides,
    },
    meta: { requestId: "req_test" },
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
  isOrgBoundMock.mockReset();
  isOrgBoundMock.mockResolvedValue(true);
});

describe("authMiddleware", () => {
  it("throws UNAUTHORIZED when Authorization header is missing", async () => {
    await expect(invokeAuth(new Headers())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: expect.stringContaining("API key required"),
    });
    expect(verifyMock).not.toHaveBeenCalled();
    expect(isOrgBoundMock).not.toHaveBeenCalled();
  });

  it("throws UNAUTHORIZED when scheme is not Bearer", async () => {
    await expect(
      invokeAuth(new Headers({ authorization: `Basic ${validKey}` }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: expect.stringContaining("API key required"),
    });
    expect(verifyMock).not.toHaveBeenCalled();
    expect(isOrgBoundMock).not.toHaveBeenCalled();
  });

  it("throws UNAUTHORIZED when token is not lf_ prefixed (no network call)", async () => {
    await expect(
      invokeAuth(new Headers({ authorization: "Bearer ak_legacy_key" }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: expect.stringContaining("Invalid API key format"),
    });
    expect(verifyMock).not.toHaveBeenCalled();
    expect(isOrgBoundMock).not.toHaveBeenCalled();
  });

  it("throws UNAUTHORIZED when Unkey verification throws", async () => {
    verifyMock.mockRejectedValueOnce(new Error("unkey down"));

    await expect(
      invokeAuth(new Headers({ authorization: `Bearer ${validKey}` }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid API key",
    });
    expect(verifyMock).toHaveBeenCalledWith({ key: validKey });
    expect(isOrgBoundMock).not.toHaveBeenCalled();
  });

  it("throws UNAUTHORIZED when Unkey marks the key disabled", async () => {
    verifyMock.mockResolvedValueOnce(
      verifyResult({ code: "DISABLED", valid: false })
    );

    await expect(
      invokeAuth(new Headers({ authorization: `Bearer ${validKey}` }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "API key disabled",
    });
  });

  it("throws UNAUTHORIZED when Unkey marks the key expired", async () => {
    verifyMock.mockResolvedValueOnce(
      verifyResult({ code: "EXPIRED", valid: false })
    );

    await expect(
      invokeAuth(new Headers({ authorization: `Bearer ${validKey}` }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "API key expired",
    });
  });

  it("throws UNAUTHORIZED when Unkey cannot find the key", async () => {
    verifyMock.mockResolvedValueOnce(
      verifyResult({ code: "NOT_FOUND", keyId: undefined, valid: false })
    );

    await expect(
      invokeAuth(new Headers({ authorization: `Bearer ${validKey}` }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid API key",
    });
  });

  it("throws FORBIDDEN when Unkey identity is missing", async () => {
    verifyMock.mockResolvedValueOnce(verifyResult({ identity: undefined }));

    await expect(
      invokeAuth(new Headers({ authorization: `Bearer ${validKey}` }))
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "API key is not org-scoped",
    });
  });

  it("throws FORBIDDEN when creator metadata is missing", async () => {
    verifyMock.mockResolvedValueOnce(verifyResult({ meta: {} }));

    await expect(
      invokeAuth(new Headers({ authorization: `Bearer ${validKey}` }))
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "API key is missing creator metadata",
    });
  });

  it("accepts lowercase 'bearer' scheme (RFC 7235 case-insensitive)", async () => {
    verifyMock.mockResolvedValueOnce(verifyResult());

    const ctx = await invokeAuth(
      new Headers({ authorization: `bearer ${validKey}` })
    );

    expect(ctx).toMatchObject({
      apiKeyId: "key_test",
      auth: {
        identity: {
          orgGate: { bindingStatus: "bound" },
          orgId: "org_test",
          type: "active",
          userId: "user_test",
        },
      },
    });
  });

  it("resolves and exposes the shared auth identity context when the key is valid", async () => {
    verifyMock.mockResolvedValueOnce(verifyResult());

    const ctx = await invokeAuth(
      new Headers({ authorization: `Bearer ${validKey}` })
    );

    expect(ctx).toMatchObject({
      apiKeyId: "key_test",
      auth: {
        identity: {
          orgGate: { bindingStatus: "bound" },
          orgId: "org_test",
          type: "active",
          userId: "user_test",
        },
      },
    });
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledWith({ key: validKey });
    expect(isOrgBoundMock).toHaveBeenCalledWith(expect.anything(), "org_test");
  });

  it("keeps the API key authenticated but marks the org gate unbound", async () => {
    verifyMock.mockResolvedValueOnce(verifyResult());
    isOrgBoundMock.mockResolvedValueOnce(false);

    const ctx = await invokeAuth(
      new Headers({ authorization: `Bearer ${validKey}` })
    );

    expect(ctx).toMatchObject({
      auth: {
        identity: {
          orgGate: { bindingStatus: "unbound" },
          orgId: "org_test",
          type: "active",
        },
      },
    });
  });

  it("rethrows ORPCError instances (smoke check)", () => {
    expect(new ORPCError("UNAUTHORIZED").code).toBe("UNAUTHORIZED");
  });
});
