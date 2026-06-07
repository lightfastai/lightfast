import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const listUserConnectorsForViewerMock = vi.fn();
const startUserConnectorOAuthMock = vi.fn();
const disconnectUserConnectorMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

vi.mock("../services/user-connectors", () => ({
  disconnectUserConnector: disconnectUserConnectorMock,
  listUserConnectorsForViewer: listUserConnectorsForViewerMock,
  startUserConnectorOAuth: startUserConnectorOAuthMock,
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { userConnectorsRouter } = await import(
  "../router/(pending-not-allowed)/user-connectors"
);

const testRouter = createTRPCRouter({
  userConnectors: userConnectorsRouter,
});
const createCaller = createCallerFactory(testRouter);

const pendingIdentity = {
  type: "pending",
  userId: "user_current",
} satisfies AuthIdentity;

const unauthenticatedIdentity = {
  type: "unauthenticated",
} satisfies AuthIdentity;

function caller(identity: AuthIdentity = pendingIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

describe("userConnectorsRouter", () => {
  beforeEach(() => {
    listUserConnectorsForViewerMock.mockReset();
    startUserConnectorOAuthMock.mockReset();
    disconnectUserConnectorMock.mockReset();

    listUserConnectorsForViewerMock.mockResolvedValue([
      { displayName: "Granola", ownerType: "user", provider: "granola" },
    ]);
    startUserConnectorOAuthMock.mockResolvedValue({
      authorizationUrl: "https://granola.test/oauth/authorize",
      mode: "connect",
    });
    disconnectUserConnectorMock.mockResolvedValue({ disconnected: true });
  });

  it("allows signed-in viewers to list, start, and disconnect private connectors without org admin", async () => {
    await expect(caller().userConnectors.list()).resolves.toEqual([
      expect.objectContaining({ ownerType: "user", provider: "granola" }),
    ]);
    await expect(
      caller().userConnectors.startConnect({ provider: "granola" })
    ).resolves.toEqual({
      authorizationUrl: "https://granola.test/oauth/authorize",
      mode: "connect",
    });
    await expect(
      caller().userConnectors.disconnect({ provider: "granola" })
    ).resolves.toEqual({ disconnected: true });

    expect(startUserConnectorOAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { identity: pendingIdentity },
      }),
      { provider: "granola" }
    );
    expect(disconnectUserConnectorMock).toHaveBeenCalledWith(
      expect.anything(),
      { provider: "granola" }
    );
  });

  it("rejects unauthenticated viewers before reaching user connector services", async () => {
    await expect(
      caller(unauthenticatedIdentity).userConnectors.list()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(unauthenticatedIdentity).userConnectors.startConnect({
        provider: "granola",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(unauthenticatedIdentity).userConnectors.disconnect({
        provider: "granola",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(listUserConnectorsForViewerMock).not.toHaveBeenCalled();
    expect(startUserConnectorOAuthMock).not.toHaveBeenCalled();
    expect(disconnectUserConnectorMock).not.toHaveBeenCalled();
  });
});
