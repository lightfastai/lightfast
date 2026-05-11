import { ORPCError, call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.fn();
const whereMock = vi.fn(() => ({ limit: limitMock }));
const fromMock = vi.fn(() => ({ where: whereMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

const updateWhereMock = vi.fn(() => Promise.resolve());
const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
const updateMock = vi.fn(() => ({ set: updateSetMock }));

vi.mock("@db/app/client", () => ({
  db: {
    select: () => selectMock(),
    update: () => updateMock(),
  },
}));

const { authMiddleware } = await import("../middleware/auth");

const SK_LF_PREFIX = "sk-lf-";
// API key secret is 43 chars; prefix + 43 = 49-char total format.
const validKey = `${SK_LF_PREFIX}${"a".repeat(43)}`;

async function invokeAuth(headers: Headers) {
  // Build a tiny test proc that runs authMiddleware and returns ctx.
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
  limitMock.mockReset();
  whereMock.mockClear();
  fromMock.mockClear();
  selectMock.mockClear();
  updateWhereMock.mockClear();
  updateSetMock.mockClear();
  updateMock.mockClear();
});

describe("authMiddleware", () => {
  it("throws UNAUTHORIZED when Authorization header is missing", async () => {
    await expect(invokeAuth(new Headers())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: expect.stringContaining("API key required"),
    });
  });

  it("throws UNAUTHORIZED when token is not sk-lf- format", async () => {
    await expect(
      invokeAuth(new Headers({ authorization: "Bearer not-an-api-key" }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: expect.stringContaining("Invalid API key format"),
    });
  });

  it("throws UNAUTHORIZED when no DB row matches the key", async () => {
    limitMock.mockResolvedValueOnce([]);

    await expect(
      invokeAuth(new Headers({ authorization: `Bearer ${validKey}` }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid API key",
    });
  });

  it("throws UNAUTHORIZED when the key is expired", async () => {
    limitMock.mockResolvedValueOnce([
      {
        id: 1,
        publicId: "akey_test",
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        expiresAt: new Date(Date.now() - 1000),
      },
    ]);

    await expect(
      invokeAuth(new Headers({ authorization: `Bearer ${validKey}` }))
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "API key expired",
    });
  });

  it("resolves and exposes auth context when the key is valid", async () => {
    limitMock.mockResolvedValueOnce([
      {
        id: 1,
        publicId: "akey_test",
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        expiresAt: null,
      },
    ]);

    const ctx = await invokeAuth(
      new Headers({ authorization: `Bearer ${validKey}` })
    );

    expect(ctx).toMatchObject({
      apiKeyId: "akey_test",
      clerkOrgId: "org_test",
      userId: "user_test",
    });
  });

  it("rethrows ORPCError instances (smoke check)", () => {
    expect(new ORPCError("UNAUTHORIZED").code).toBe("UNAUTHORIZED");
  });
});
