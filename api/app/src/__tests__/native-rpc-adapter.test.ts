import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class NativeAuthError extends Error {
    readonly code: "FORBIDDEN" | "INTERNAL_SERVER_ERROR" | "UNAUTHORIZED";
    readonly status: number;

    constructor(input: {
      code: "FORBIDDEN" | "INTERNAL_SERVER_ERROR" | "UNAUTHORIZED";
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
    getNativeAuthSessionForRequest: vi.fn(),
    NativeAuthError,
  };
});

vi.mock("../native-auth", () => ({
  getNativeAuthSessionForRequest: mocks.getNativeAuthSessionForRequest,
  isNativeAuthError: (error: unknown) => error instanceof mocks.NativeAuthError,
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
    mocks.getNativeAuthSessionForRequest.mockResolvedValue(session);
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
    expect(mocks.getNativeAuthSessionForRequest).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      source: "desktop",
    });
    const [firstCall] = mocks.getNativeAuthSessionForRequest.mock.calls;
    expect(firstCall).toBeDefined();
    const { headers } = firstCall![0];
    expect(headers.get("authorization")).toBe("Bearer access_test");
  });

  it("handles CLI auth.session through the CLI native OAuth source", async () => {
    mocks.getNativeAuthSessionForRequest.mockResolvedValue({
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
    expect(mocks.getNativeAuthSessionForRequest).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      source: "cli",
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
    expect(mocks.getNativeAuthSessionForRequest).not.toHaveBeenCalled();
  });

  it("maps native OAuth errors to the native RPC error envelope", async () => {
    mocks.getNativeAuthSessionForRequest.mockRejectedValue(
      new mocks.NativeAuthError({
        code: "UNAUTHORIZED",
        message: "Lightfast native OAuth authentication required.",
        status: 401,
      })
    );

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
  });

  it("treats invalid backend output as an internal native RPC error", async () => {
    mocks.getNativeAuthSessionForRequest.mockResolvedValue({
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
