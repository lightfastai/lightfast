import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface NativeOAuthFacadeInput {
  headers: Headers;
  source: "cli" | "desktop";
}

const oauthConfig = vi.fn();
const finalize = vi.fn();
const createNativeOAuthFacadeCaller = vi.fn(
  async (_input: NativeOAuthFacadeInput) => ({
    native: { auth: { finalize, oauthConfig } },
  })
);

vi.mock("~/trpc/callers/oauth", () => ({
  createNativeOAuthFacadeCaller,
}));

describe("native OAuth facade routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns CLI native auth config through the native tRPC caller", async () => {
    oauthConfig.mockResolvedValueOnce({
      authorizationEndpoint: "https://clerk.example.com/oauth/authorize",
      client: "cli",
      clientId: "cli_client_test",
      issuer: "https://clerk.example.com",
      scopes: ["openid", "profile", "email", "offline_access"],
      supportsDynamicLoopbackPort: true,
      tokenEndpoint: "https://clerk.example.com/oauth/token",
    });

    const { GET } = await import(
      "../../../../app/(app)/(oauth)/api/oauth/[client]/config/route"
    );
    const res = await GET(
      new Request("https://app.test/api/oauth/cli/config"),
      { params: Promise.resolve({ client: "cli" }) }
    );

    await expect(res.json()).resolves.toMatchObject({
      client: "cli",
      clientId: "cli_client_test",
      supportsDynamicLoopbackPort: true,
    });
    expect(oauthConfig).toHaveBeenCalledWith({ client: "cli" });
  });

  it("returns Desktop native auth config through the native tRPC caller", async () => {
    oauthConfig.mockResolvedValueOnce({
      authorizationEndpoint: "https://clerk.example.com/oauth/authorize",
      client: "desktop",
      clientId: "desktop_client_test",
      issuer: "https://clerk.example.com",
      scopes: ["openid", "profile", "email", "offline_access"],
      supportsDynamicLoopbackPort: true,
      tokenEndpoint: "https://clerk.example.com/oauth/token",
    });

    const { GET } = await import(
      "../../../../app/(app)/(oauth)/api/oauth/[client]/config/route"
    );
    const res = await GET(
      new Request("https://app.test/api/oauth/desktop/config"),
      { params: Promise.resolve({ client: "desktop" }) }
    );

    await expect(res.json()).resolves.toMatchObject({
      client: "desktop",
      clientId: "desktop_client_test",
      supportsDynamicLoopbackPort: true,
    });
    expect(oauthConfig).toHaveBeenCalledWith({ client: "desktop" });
  });

  it("finalizes through native tRPC and forwards bearer/native headers", async () => {
    finalize.mockResolvedValueOnce({
      client: "desktop",
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      user: { email: "dev@example.com", id: "user_1" },
    });

    const { POST } = await import(
      "../../../../app/(app)/(oauth)/api/oauth/finalize/route"
    );
    const res = await POST(
      new Request("https://app.test/api/oauth/finalize", {
        method: "POST",
        headers: { authorization: "Bearer access" },
        body: JSON.stringify({
          attemptId: "attempt_123456789",
          client: "desktop",
          state: "state_1234567890123",
        }),
      })
    );

    await expect(res.json()).resolves.toEqual({
      client: "desktop",
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      user: { email: "dev@example.com", id: "user_1" },
    });
    expect(finalize).toHaveBeenCalledWith({
      attemptId: "attempt_123456789",
      client: "desktop",
      state: "state_1234567890123",
    });
    expect(createNativeOAuthFacadeCaller).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      source: "desktop",
    });
    const headers = createNativeOAuthFacadeCaller.mock.calls[0]?.[0]
      .headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer access");
  });

  it("maps tRPC errors to JSON responses", async () => {
    finalize.mockRejectedValueOnce(
      new TRPCError({
        code: "FORBIDDEN",
        message: "Native auth user mismatch",
      })
    );

    const { POST } = await import(
      "../../../../app/(app)/(oauth)/api/oauth/finalize/route"
    );
    const res = await POST(
      new Request("https://app.test/api/oauth/finalize", {
        method: "POST",
        body: JSON.stringify({
          attemptId: "attempt_123456789",
          client: "cli",
          state: "state_1234567890123",
        }),
      })
    );

    await expect(res.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "Native auth user mismatch" },
    });
    expect(res.status).toBe(403);
  });

  it("maps missing native bearer auth to UNAUTHORIZED", async () => {
    finalize.mockRejectedValueOnce(
      new TRPCError({
        code: "UNAUTHORIZED",
        message: "Lightfast native OAuth authentication required.",
      })
    );

    const { POST } = await import(
      "../../../../app/(app)/(oauth)/api/oauth/finalize/route"
    );
    const res = await POST(
      new Request("https://app.test/api/oauth/finalize", {
        method: "POST",
        body: JSON.stringify({
          attemptId: "attempt_123456789",
          client: "cli",
          state: "state_1234567890123",
        }),
      })
    );

    await expect(res.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Lightfast native OAuth authentication required.",
      },
    });
    expect(res.status).toBe(401);
  });

  it("maps expired native bearer token to UNAUTHORIZED", async () => {
    finalize.mockRejectedValueOnce(
      new TRPCError({
        code: "UNAUTHORIZED",
        message: "Lightfast native OAuth token expired.",
      })
    );

    const { POST } = await import(
      "../../../../app/(app)/(oauth)/api/oauth/finalize/route"
    );
    const res = await POST(
      new Request("https://app.test/api/oauth/finalize", {
        method: "POST",
        headers: { authorization: "Bearer expired_token" },
        body: JSON.stringify({
          attemptId: "attempt_123456789",
          client: "cli",
          state: "state_1234567890123",
        }),
      })
    );

    await expect(res.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Lightfast native OAuth token expired.",
      },
    });
    expect(res.status).toBe(401);
  });

  it("does not expose raw tRPC messages for server errors", async () => {
    finalize.mockRejectedValueOnce(
      new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "database password leaked in error text",
      })
    );

    const { POST } = await import(
      "../../../../app/(app)/(oauth)/api/oauth/finalize/route"
    );
    const res = await POST(
      new Request("https://app.test/api/oauth/finalize", {
        method: "POST",
        headers: { authorization: "Bearer access" },
        body: JSON.stringify({
          attemptId: "attempt_123456789",
          client: "cli",
          state: "state_1234567890123",
        }),
      })
    );

    await expect(res.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected auth error",
      },
    });
    expect(res.status).toBe(500);
  });
});
