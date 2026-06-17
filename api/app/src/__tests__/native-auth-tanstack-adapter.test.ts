import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class NativeAuthError extends Error {
    readonly code: "FORBIDDEN" | "UNAUTHORIZED";
    readonly status: number;

    constructor(input: {
      code: "FORBIDDEN" | "UNAUTHORIZED";
      message: string;
      status: number;
    }) {
      super(input.message);
      this.name = "NativeAuthError";
      this.code = input.code;
      this.status = input.status;
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
    mocks.listNativeOrganizationsForAuthContext.mockRejectedValue(
      new mocks.NativeAuthError({ code, message, status })
    );

    await expect(listNativeAuthOrganizations()).rejects.toThrow(message);

    expect(mocks.setResponseStatus).toHaveBeenCalledWith(status);
  });
});
