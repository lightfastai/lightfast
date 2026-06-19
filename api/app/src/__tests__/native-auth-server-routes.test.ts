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
    finalizeNativeAuthAttemptForNativeOAuth: vi.fn(),
    getNativeAuthSessionForNativeOAuth: vi.fn(),
    getNativeOAuthClientConfig: vi.fn(),
    NativeAuthError,
    resolveAuthContextFromClerk: vi.fn(),
  };
});

vi.mock("@db/app/client", () => ({ db: mocks.db }));

vi.mock("../auth/identity", () => ({
  resolveAuthContextFromClerk: mocks.resolveAuthContextFromClerk,
}));

vi.mock("../native-auth", () => ({
  finalizeNativeAuthAttemptForNativeOAuth:
    mocks.finalizeNativeAuthAttemptForNativeOAuth,
  getNativeAuthSessionForNativeOAuth: mocks.getNativeAuthSessionForNativeOAuth,
  getNativeOAuthClientConfig: mocks.getNativeOAuthClientConfig,
  isNativeAuthError: (error: unknown) => error instanceof mocks.NativeAuthError,
  NativeAuthError: mocks.NativeAuthError,
}));

const {
  handleNativeOAuthDesktopSessionRequest,
  handleNativeOAuthFinalizeRequest,
} = await import("../native-auth/server-routes");

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

function activeNativeAuth(client: "cli" | "desktop" = "desktop") {
  return {
    access: {
      client,
      clientId: `${client}_client_test`,
      kind: "clerk-oauth" as const,
      scopes: ["openid"],
      userId: "user_1",
    },
    identity: {
      orgGate: { bindingStatus: "bound" as const, nextSetupRequirement: null },
      orgId: "org_1",
      type: "active" as const,
      userId: "user_1",
    },
  };
}

function finalizeRequest(body: unknown) {
  return new Request("https://app.lightfast.test/api/oauth/finalize", {
    body: JSON.stringify(body),
    headers: {
      authorization: "Bearer access_test",
      "content-type": "application/json",
      "x-lightfast-organization-id": "org_1",
    },
    method: "POST",
  });
}

function desktopSessionRequest() {
  return new Request("https://app.lightfast.test/api/oauth/desktop/session", {
    headers: {
      authorization: "Bearer access_test",
      "x-lightfast-organization-id": "org_1",
    },
    method: "GET",
  });
}

describe("native OAuth server routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.finalizeNativeAuthAttemptForNativeOAuth.mockResolvedValue(session);
    mocks.getNativeAuthSessionForNativeOAuth.mockResolvedValue(session);
    mocks.resolveAuthContextFromClerk.mockResolvedValue(activeNativeAuth());
  });

  it("finalizes native OAuth by stamping the body client and passing the OAuth user", async () => {
    const body = {
      attemptId: "attempt_123456789",
      client: "cli" as const,
      state: "state_1234567890",
    };
    mocks.resolveAuthContextFromClerk.mockResolvedValue(
      activeNativeAuth("cli")
    );

    const response = await handleNativeOAuthFinalizeRequest(
      finalizeRequest(body)
    );

    await expect(response.json()).resolves.toEqual(session);
    expect(response.status).toBe(200);
    expect(mocks.resolveAuthContextFromClerk).toHaveBeenCalledWith({
      db: mocks.db,
      headers: expect.any(Headers),
    });
    const [firstCall] = mocks.resolveAuthContextFromClerk.mock.calls;
    expect(firstCall).toBeDefined();
    expect(firstCall![0].headers.get("authorization")).toBe(
      "Bearer access_test"
    );
    expect(firstCall![0].headers.get("x-lightfast-native-client")).toBe("cli");
    expect(mocks.finalizeNativeAuthAttemptForNativeOAuth).toHaveBeenCalledWith({
      data: body,
      db: mocks.db,
      userId: "user_1",
    });
  });

  it("allows pending native OAuth identity when finalizing an attempt", async () => {
    const body = {
      attemptId: "attempt_123456789",
      client: "desktop" as const,
      state: "state_1234567890",
    };
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

    const response = await handleNativeOAuthFinalizeRequest(
      finalizeRequest(body)
    );

    expect(response.status).toBe(200);
    expect(mocks.finalizeNativeAuthAttemptForNativeOAuth).toHaveBeenCalledWith({
      data: body,
      db: mocks.db,
      userId: "user_1",
    });
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
  ])("maps $label desktop session auth to 401", async ({ auth }) => {
    mocks.resolveAuthContextFromClerk.mockResolvedValue(auth);

    const response = await handleNativeOAuthDesktopSessionRequest(
      desktopSessionRequest()
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Lightfast native OAuth authentication required.",
      },
    });
    expect(response.status).toBe(401);
    expect(mocks.getNativeAuthSessionForNativeOAuth).not.toHaveBeenCalled();
  });

  it("maps pending desktop session identity to 403", async () => {
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

    const response = await handleNativeOAuthDesktopSessionRequest(
      desktopSessionRequest()
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Native session organization required",
      },
    });
    expect(response.status).toBe(403);
    expect(mocks.getNativeAuthSessionForNativeOAuth).not.toHaveBeenCalled();
  });

  it("loads desktop session metadata with explicit native OAuth values", async () => {
    const response = await handleNativeOAuthDesktopSessionRequest(
      desktopSessionRequest()
    );

    await expect(response.json()).resolves.toEqual(session);
    expect(response.status).toBe(200);
    expect(mocks.getNativeAuthSessionForNativeOAuth).toHaveBeenCalledWith({
      client: "desktop",
      db: mocks.db,
      organizationId: "org_1",
      userId: "user_1",
    });
  });
});
