import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class NativeAuthError extends Error {
    readonly code: "FORBIDDEN";
    readonly status: number;

    constructor(status: number, message: string) {
      super(message);
      this.name = "NativeAuthError";
      this.code = "FORBIDDEN";
      this.status = status;
    }
  }

  return {
    createNativeAuthAttemptForAuthContext: vi.fn(),
    getRequest: vi.fn(),
    listNativeOrganizationsForAuthContext: vi.fn(),
    NativeAuthError,
    resolveAuthContextFromClerk: vi.fn(),
    setResponseHeader: vi.fn(),
    setResponseStatus: vi.fn(),
  };
});

vi.mock("@db/app/client", () => ({ db: {} }));

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

vi.mock("../auth/identity", () => ({
  resolveAuthContextFromClerk: mocks.resolveAuthContextFromClerk,
}));

vi.mock("../native-auth", () => ({
  createNativeAuthAttemptForAuthContext:
    mocks.createNativeAuthAttemptForAuthContext,
  isNativeAuthError: (error: unknown) => error instanceof mocks.NativeAuthError,
  listNativeOrganizationsForAuthContext:
    mocks.listNativeOrganizationsForAuthContext,
}));

const { listNativeAuthOrganizations } = await import(
  "../adapters/tanstack/native-auth"
);

describe("native auth TanStack adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequest.mockReturnValue(
      new Request("https://lightfast.localhost/oauth/cli/start")
    );
    mocks.resolveAuthContextFromClerk.mockResolvedValue({
      identity: { type: "pending", userId: "user_1" },
    });
  });

  it("preserves native auth status codes on server function errors", async () => {
    mocks.listNativeOrganizationsForAuthContext.mockRejectedValue(
      new mocks.NativeAuthError(403, "User is not a member")
    );

    await expect(listNativeAuthOrganizations()).rejects.toThrow(
      "User is not a member"
    );

    expect(mocks.setResponseStatus).toHaveBeenCalledWith(403);
  });
});
