import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { AuthIdentity } from "../auth/identity";
import {
  actorFromAuthIdentity,
  DomainError,
  defineCommand,
  defineCommandSurface,
  dispatchCommand,
  requireBoundClerkOrgActor,
} from "../domain";

const apiSrcRoot = resolve(import.meta.dirname, "..");

function apiSource(path: string) {
  return readFileSync(resolve(apiSrcRoot, path), "utf8");
}

const boundIdentity: Extract<AuthIdentity, { type: "active" }> = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};

describe("actorFromAuthIdentity", () => {
  it("creates a Clerk user actor from an active bound identity", () => {
    expect(actorFromAuthIdentity(boundIdentity, "web")).toEqual({
      kind: "clerkUser",
      orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
      orgId: "org_test",
      source: "web",
      userId: "user_test",
    });
  });

  it("creates a Clerk user actor from a pending identity without active org authority", () => {
    expect(
      actorFromAuthIdentity({ type: "pending", userId: "user_test" }, "web")
    ).toEqual({
      kind: "clerkUser",
      source: "web",
      userId: "user_test",
    });
  });
});

describe("requireBoundClerkOrgActor", () => {
  it("returns the actor when the organization is bound", () => {
    const actor = actorFromAuthIdentity(boundIdentity, "web");
    expect(requireBoundClerkOrgActor({ actor })).toEqual(actor);
  });

  it("rejects unbound organizations", () => {
    const actor = actorFromAuthIdentity(
      {
        ...boundIdentity,
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
      },
      "web"
    );

    expect(() => requireBoundClerkOrgActor({ actor })).toThrowError(
      expect.objectContaining({
        code: "ORG_SETUP_REQUIRED",
        kind: "authz",
      })
    );
  });

  it("rejects pending users without active org authority", () => {
    const actor = actorFromAuthIdentity(
      { type: "pending", userId: "user_test" },
      "web"
    );

    expect(() => requireBoundClerkOrgActor({ actor })).toThrowError(
      expect.objectContaining({
        code: "ORG_REQUIRED",
        kind: "authz",
      })
    );
  });
});

describe("dispatchCommand", () => {
  it("validates input and output around a command run", async () => {
    const command = defineCommand({
      name: "test.echo",
      input: z.object({ value: z.string() }),
      output: z.object({ value: z.string() }),
      run: async ({ input }) => ({ value: input.value.toUpperCase() }),
    });
    const surface = defineCommandSurface({ "test.echo": command });

    await expect(
      dispatchCommand(surface, {
        command: "test.echo",
        ctx: { actor: actorFromAuthIdentity(boundIdentity, "web") },
        input: { value: "hello" },
      })
    ).resolves.toEqual({ value: "HELLO" });
  });

  it("throws a validation domain error for unknown commands", async () => {
    const surface = defineCommandSurface({});

    await expect(
      dispatchCommand(surface, {
        command: "missing.command",
        ctx: { actor: actorFromAuthIdentity(boundIdentity, "web") },
        input: {},
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "COMMAND_NOT_FOUND",
        kind: "not_found",
      })
    );
  });

  it("uses DomainError as the common error base", () => {
    const error = new DomainError(
      "validation",
      "INVALID_INPUT",
      "Invalid input"
    );
    expect(error.kind).toBe("validation");
    expect(error.code).toBe("INVALID_INPUT");
  });
});

describe("domain actor boundary", () => {
  it("stays independent of API-key auth result shapes and request transport types", () => {
    const actorSource = apiSource("domain/actor.ts");

    expect(actorSource).not.toContain("../auth/api-key");
    expect(actorSource).not.toContain("ApiKeyAuthResult");
    expect(actorSource).not.toContain("Headers");
    expect(actorSource).not.toContain("Request");
    expect(actorSource).not.toContain("Response");
  });
});
