import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import { ValidationError } from "../domain/errors";
import {
  disconnectUserConnectorCommand,
  startUserConnectorCommand,
  type UserConnectorCommandDeps,
} from "../domain/user-connectors";

const serviceMocks = vi.hoisted(() => ({
  disconnectGranolaUserConnector: vi.fn(),
  startGranolaUserConnectorOAuth: vi.fn(),
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
  return {
    db: {} as Database,
    disconnectGranolaUserConnector: serviceMocks.disconnectGranolaUserConnector,
    request: {},
    startGranolaUserConnectorOAuth: serviceMocks.startGranolaUserConnectorOAuth,
  } satisfies UserConnectorCommandDeps;
}

describe("user connector domain commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps user connector commands free of raw auth and transport types", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../domain/user-connectors/commands.ts"),
      "utf8"
    );

    expect(source).not.toContain("../../auth/identity");
    expect(source).not.toContain("AuthIdentity");
    expect(source).not.toContain("Headers");
  });

  it("keeps direct Granola commands pinned to the Granola provider", () => {
    expect(
      startUserConnectorCommand.input.safeParse({ provider: "notion" }).success
    ).toBe(false);
    expect(
      disconnectUserConnectorCommand.input.safeParse({ provider: "notion" })
        .success
    ).toBe(false);
  });

  it("preserves domain errors raised by user connector services", async () => {
    serviceMocks.startGranolaUserConnectorOAuth.mockRejectedValueOnce(
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
