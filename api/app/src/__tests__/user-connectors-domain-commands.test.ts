import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import { ValidationError } from "../domain/errors";
import {
  createDefaultUserConnectorCommandDeps,
  startUserConnectorCommand,
} from "../domain/user-connectors";

const serviceMocks = vi.hoisted(() => ({
  disconnectUserConnector: vi.fn(),
  startUserConnectorOAuth: vi.fn(),
}));

vi.mock("../services/user-connectors", () => ({
  disconnectUserConnector: serviceMocks.disconnectUserConnector,
  startUserConnectorOAuth: serviceMocks.startUserConnectorOAuth,
}));

const pendingIdentity = {
  type: "pending",
  userId: "user_current",
} satisfies AuthIdentity;

function ctx() {
  return {
    actor: actorFromAuthIdentity(pendingIdentity, "web"),
    request: { id: "req_test", source: "tanstack" as const },
  };
}

function deps() {
  return createDefaultUserConnectorCommandDeps({
    db: {} as Database,
    disconnectUserConnector: serviceMocks.disconnectUserConnector,
    headers: new Headers(),
    startUserConnectorOAuth: serviceMocks.startUserConnectorOAuth,
  });
}

describe("user connector domain commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves domain errors raised by user connector services", async () => {
    serviceMocks.startUserConnectorOAuth.mockRejectedValueOnce(
      new ValidationError(
        "USER_CONNECTOR_UNSUPPORTED_PROVIDER",
        "Unsupported user connector provider: fake"
      )
    );

    await expect(
      startUserConnectorCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { provider: "granola" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "USER_CONNECTOR_UNSUPPORTED_PROVIDER",
        kind: "validation",
      })
    );
  });
});
