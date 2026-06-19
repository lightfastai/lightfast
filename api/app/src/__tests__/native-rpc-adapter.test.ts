import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class NativeAuthError extends Error {
    readonly code: "FORBIDDEN" | "INTERNAL_SERVER_ERROR" | "UNAUTHORIZED";
    readonly status: number;

    constructor(
      code: "FORBIDDEN" | "INTERNAL_SERVER_ERROR" | "UNAUTHORIZED",
      message: string
    ) {
      super(message);
      this.name = "NativeAuthError";
      this.code = code;
      this.status =
        code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 500;
    }
  }

  return {
    db: {},
    getNativeAuthSessionForNativeOAuth: vi.fn(),
    NativeAuthError,
    resolveAuthContextFromClerk: vi.fn(),
  };
});

vi.mock("@db/app/client", () => ({ db: mocks.db }));

vi.mock("../auth/identity", () => ({
  resolveAuthContextFromClerk: mocks.resolveAuthContextFromClerk,
}));

vi.mock("../native-auth", () => ({
  getNativeAuthSessionForNativeOAuth: mocks.getNativeAuthSessionForNativeOAuth,
  isNativeAuthError: (error: unknown) => error instanceof mocks.NativeAuthError,
  NativeAuthError: mocks.NativeAuthError,
}));

const { handleCliNativeRpcRequest } = await import("../adapters/cli-api");
const { handleDesktopNativeRpcRequest } = await import(
  "../adapters/desktop-api"
);

function rpcRequest(body: unknown) {
  return new Request("https://app.lightfast.test/api/desktop/rpc", {
    body: JSON.stringify(body),
    headers: {
      accept: "application/json",
      authorization: "Bearer access_test",
      "content-type": "application/json",
      "x-lightfast-organization-id": "org_1",
    },
    method: "POST",
  });
}

const session = {
  client: "desktop" as const,
  organization: { id: "org_1", name: "Acme", slug: "acme" },
  user: {
    email: "dev@example.com",
    id: "user_1",
    imageUrl: "https://img.example.com/user_1.png",
    initials: "JP",
    username: "jeevanpillay",
  },
};

describe("native RPC adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveAuthContextFromClerk.mockResolvedValue({
      access: {
        client: "desktop",
        clientId: "desktop_client_test",
        kind: "clerk-oauth",
        scopes: ["openid"],
        userId: "user_1",
      },
      identity: {
        orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
        orgId: "org_1",
        type: "active",
        userId: "user_1",
      },
    });
    mocks.getNativeAuthSessionForNativeOAuth.mockResolvedValue(session);
  });

  it("handles desktop auth.session through the desktop native OAuth source", async () => {
    const response = await handleDesktopNativeRpcRequest(
      rpcRequest({ command: "auth.session" })
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: session,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(mocks.resolveAuthContextFromClerk).toHaveBeenCalledWith({
      db: mocks.db,
      headers: expect.any(Headers),
    });
    const [firstCall] = mocks.resolveAuthContextFromClerk.mock.calls;
    expect(firstCall).toBeDefined();
    const { headers } = firstCall![0];
    expect(headers.get("authorization")).toBe("Bearer access_test");
    expect(headers.get("x-lightfast-native-client")).toBe("desktop");
    expect(mocks.getNativeAuthSessionForNativeOAuth).toHaveBeenCalledWith({
      client: "desktop",
      db: mocks.db,
      organizationId: "org_1",
      userId: "user_1",
    });
  });

  it("handles CLI auth.session through the CLI native OAuth source", async () => {
    mocks.resolveAuthContextFromClerk.mockResolvedValue({
      access: {
        client: "cli",
        clientId: "cli_client_test",
        kind: "clerk-oauth",
        scopes: ["openid"],
        userId: "user_1",
      },
      identity: {
        orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
        orgId: "org_1",
        type: "active",
        userId: "user_1",
      },
    });
    mocks.getNativeAuthSessionForNativeOAuth.mockResolvedValue({
      ...session,
      client: "cli",
    });

    const response = await handleCliNativeRpcRequest(
      rpcRequest({ command: "auth.session" })
    );

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: { client: "cli", organization: { id: "org_1" } },
    });
    const [firstCall] = mocks.resolveAuthContextFromClerk.mock.calls;
    expect(firstCall).toBeDefined();
    expect(firstCall![0].headers.get("x-lightfast-native-client")).toBe("cli");
    expect(mocks.getNativeAuthSessionForNativeOAuth).toHaveBeenCalledWith({
      client: "cli",
      db: mocks.db,
      organizationId: "org_1",
      userId: "user_1",
    });
  });

  it("rejects command input that is not part of the explicit contract", async () => {
    const response = await handleDesktopNativeRpcRequest(
      rpcRequest({
        command: "auth.session",
        input: { organizationId: "org_1" },
      })
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "Native RPC request is invalid.",
      },
    });
    expect(response.status).toBe(400);
    expect(mocks.getNativeAuthSessionForNativeOAuth).not.toHaveBeenCalled();
  });

  it("rejects explicit null command input", async () => {
    const response = await handleDesktopNativeRpcRequest(
      rpcRequest({ command: "auth.session", input: null })
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "Native RPC request is invalid.",
      },
    });
    expect(response.status).toBe(400);
    expect(mocks.getNativeAuthSessionForNativeOAuth).not.toHaveBeenCalled();
  });

  it.each([
    {
      code: "FORBIDDEN" as const,
      label: "missing organization",
      message: "Native session organization required",
      status: 403,
    },
    {
      code: "FORBIDDEN" as const,
      label: "wrong organization",
      message: "User is not a member of the selected organization",
      status: 403,
    },
    {
      code: "UNAUTHORIZED" as const,
      label: "expired token",
      message: "Lightfast native OAuth authentication required.",
      status: 401,
    },
  ])("maps native OAuth $label errors to the native RPC error envelope", async ({
    code,
    message,
    status,
  }) => {
    mocks.getNativeAuthSessionForNativeOAuth.mockRejectedValue(
      new mocks.NativeAuthError(code, message)
    );

    const response = await handleDesktopNativeRpcRequest(
      rpcRequest({ command: "auth.session" })
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code,
        message,
      },
    });
    expect(response.status).toBe(status);
  });

  it.each([
    {
      auth: { identity: { type: "unauthenticated" as const } },
      label: "unauthenticated",
    },
    {
      auth: {
        access: {
          has: vi.fn(),
          kind: "clerk-session" as const,
          orgId: "org_1",
          userId: "user_1",
        },
        identity: {
          orgGate: {
            bindingStatus: "bound" as const,
            nextSetupRequirement: null,
          },
          orgId: "org_1",
          type: "active" as const,
          userId: "user_1",
        },
      },
      label: "cookie session",
    },
    {
      auth: {
        access: {
          client: "cli" as const,
          clientId: "cli_client_test",
          kind: "clerk-oauth" as const,
          scopes: ["openid"],
          userId: "user_1",
        },
        identity: {
          orgGate: {
            bindingStatus: "bound" as const,
            nextSetupRequirement: null,
          },
          orgId: "org_1",
          type: "active" as const,
          userId: "user_1",
        },
      },
      label: "wrong native client",
    },
  ])("maps resolver-derived $label auth to unauthorized", async ({ auth }) => {
    mocks.resolveAuthContextFromClerk.mockResolvedValue(auth);

    const response = await handleDesktopNativeRpcRequest(
      rpcRequest({ command: "auth.session" })
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Lightfast native OAuth authentication required.",
      },
    });
    expect(response.status).toBe(401);
    expect(mocks.getNativeAuthSessionForNativeOAuth).not.toHaveBeenCalled();
  });

  it("maps resolver-derived pending native OAuth identity to forbidden", async () => {
    mocks.resolveAuthContextFromClerk.mockResolvedValue({
      access: {
        client: "desktop",
        clientId: "desktop_client_test",
        kind: "clerk-oauth",
        scopes: ["openid"],
        userId: "user_1",
      },
      identity: { type: "pending", userId: "user_1" },
    });

    const response = await handleDesktopNativeRpcRequest(
      rpcRequest({ command: "auth.session" })
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Native session organization required",
      },
    });
    expect(response.status).toBe(403);
    expect(mocks.getNativeAuthSessionForNativeOAuth).not.toHaveBeenCalled();
  });

  it("treats invalid backend output as an internal native RPC error", async () => {
    mocks.getNativeAuthSessionForNativeOAuth.mockResolvedValue({
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      user: { email: "dev@example.com", id: "user_1" },
    });

    const response = await handleDesktopNativeRpcRequest(
      rpcRequest({ command: "auth.session" })
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected native RPC error",
      },
    });
    expect(response.status).toBe(500);
  });
});
