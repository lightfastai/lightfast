import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class NativeAuthError extends Error {
    readonly code: "FORBIDDEN" | "UNAUTHORIZED";
    readonly status: number;

    constructor(code: "FORBIDDEN" | "UNAUTHORIZED", message: string) {
      super(message);
      this.name = "NativeAuthError";
      this.code = code;
      this.status = code === "UNAUTHORIZED" ? 401 : 403;
    }
  }

  return {
    createNativeAuthAttemptForUser: vi.fn(),
    db: {},
    getRequest: vi.fn(),
    listNativeOrganizationsForUser: vi.fn(),
    NativeAuthError,
    redirect: vi.fn((input) => input),
    resolveAuthContextFromClerk: vi.fn(),
    setResponseHeader: vi.fn(),
    setResponseStatus: vi.fn(),
  };
});

vi.mock("@db/app/client", () => ({ db: mocks.db }));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    handler: (handler: (input?: unknown) => unknown) => (input?: unknown) =>
      handler(input),
    inputValidator: () => ({
      handler:
        (handler: (input: { data: unknown }) => unknown) =>
        (input: { data: unknown }) =>
          handler(input),
    }),
  }),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: mocks.getRequest,
  setResponseHeader: mocks.setResponseHeader,
  setResponseStatus: mocks.setResponseStatus,
}));

vi.mock("@tanstack/react-router", () => ({
  redirect: mocks.redirect,
}));

vi.mock("../auth/identity", () => ({
  resolveAuthContextFromClerk: mocks.resolveAuthContextFromClerk,
}));

vi.mock("../native-auth", () => ({
  createNativeAuthAttemptForUser: mocks.createNativeAuthAttemptForUser,
  isNativeAuthError: (error: unknown) => error instanceof mocks.NativeAuthError,
  listNativeOrganizationsForUser: mocks.listNativeOrganizationsForUser,
  NativeAuthError: mocks.NativeAuthError,
}));

const {
  createNativeAuthAttempt,
  listNativeAuthOrganizations,
  loadNativeAuthOrganizations,
} = await import("../adapters/tanstack/native-auth");

describe("native auth TanStack adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequest.mockReturnValue(
      new Request("https://lightfast.localhost/oauth/cli/start")
    );
    mocks.resolveAuthContextFromClerk.mockResolvedValue({
      identity: { type: "pending", userId: "user_1" },
    });
    mocks.createNativeAuthAttemptForUser.mockResolvedValue({
      attemptId: "native_attempt_test",
      authorizationUrl: "https://clerk.example.com/oauth/authorize",
    });
    mocks.listNativeOrganizationsForUser.mockResolvedValue([]);
  });

  it("lists native auth organizations for the resolved signed-in user", async () => {
    await expect(listNativeAuthOrganizations()).resolves.toEqual([]);

    expect(mocks.resolveAuthContextFromClerk).toHaveBeenCalledWith({
      db: mocks.db,
      headers: expect.any(Headers),
    });
    expect(mocks.listNativeOrganizationsForUser).toHaveBeenCalledWith({
      db: mocks.db,
      userId: "user_1",
    });
  });

  it("creates native auth attempts for the resolved signed-in user", async () => {
    const data = {
      client: "cli",
      codeChallenge: "a".repeat(43),
      codeChallengeMethod: "S256",
      organizationId: "org_1",
      redirectUri: "http://127.0.0.1:54321/callback",
      stateNonce: "state_nonce_test1",
    } as const;

    await expect(createNativeAuthAttempt({ data })).resolves.toEqual({
      attemptId: "native_attempt_test",
      authorizationUrl: "https://clerk.example.com/oauth/authorize",
    });

    expect(mocks.createNativeAuthAttemptForUser).toHaveBeenCalledWith({
      data,
      db: mocks.db,
      userId: "user_1",
    });
  });

  it.each([
    {
      code: "UNAUTHORIZED" as const,
      label: "expired token",
      message: "Lightfast native OAuth authentication required.",
      status: 401,
    },
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
      code: "FORBIDDEN" as const,
      label: "membership mismatch",
      message: "User is not a member",
      status: 403,
    },
  ])("preserves native auth status codes on $label errors", async ({
    code,
    message,
    status,
  }) => {
    mocks.listNativeOrganizationsForUser.mockRejectedValue(
      new mocks.NativeAuthError(code, message)
    );

    await expect(listNativeAuthOrganizations()).rejects.toThrow(message);

    expect(mocks.setResponseStatus).toHaveBeenCalledWith(status);
  });

  it("redirects the OAuth start loader to sign in when unauthenticated", async () => {
    mocks.getRequest.mockReturnValue(
      new Request("https://lightfast.localhost/oauth/cli/start?state=abc")
    );
    mocks.resolveAuthContextFromClerk.mockResolvedValue({
      identity: { type: "unauthenticated" },
    });

    await expect(loadNativeAuthOrganizations()).rejects.toMatchObject({
      search: { redirect_url: "/oauth/cli/start?state=abc" },
      throw: true,
      to: "/sign-in",
    });

    expect(mocks.redirect).toHaveBeenCalledWith({
      search: { redirect_url: "/oauth/cli/start?state=abc" },
      throw: true,
      to: "/sign-in",
    });
    expect(mocks.setResponseStatus).not.toHaveBeenCalled();
    expect(mocks.listNativeOrganizationsForUser).not.toHaveBeenCalled();
  });
});
