import { isContractProcedure } from "@orpc/contract";
import { isProcedure } from "@orpc/server";
import { apiContract } from "@repo/api-contract";
import { describe, expect, it, vi } from "vitest";

const getActiveOrgBindingMock = vi.fn();

vi.mock("@vendor/unkey/server", () => ({
  getUnkeyClient: () => ({
    keys: { verifyKey: vi.fn() },
  }),
}));

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  createSignal: vi.fn(),
  getActiveOrgBinding: getActiveOrgBindingMock,
  getSignalByPublicId: vi.fn(),
  markSignalFailed: vi.fn(),
}));

const { orpcRouter } = await import("../router");

function collectContractProcedurePaths(
  node: unknown,
  keyPath: string[] = []
): string[] {
  if (isContractProcedure(node)) {
    return [keyPath.join(".")];
  }

  if (!node || typeof node !== "object") {
    return [];
  }

  return Object.entries(node).flatMap(([key, child]) =>
    collectContractProcedurePaths(child, [...keyPath, key])
  );
}

function collectRouterProcedurePaths(
  node: unknown,
  keyPath: string[] = []
): string[] {
  if (isProcedure(node)) {
    return [keyPath.join(".")];
  }

  if (!node || typeof node !== "object") {
    return [];
  }

  return Object.entries(node).flatMap(([key, child]) =>
    collectRouterProcedurePaths(child, [...keyPath, key])
  );
}

describe("oRPC contract coverage", () => {
  it("implements exactly the public contract procedures", () => {
    const contractPaths = collectContractProcedurePaths(apiContract);
    const routerPaths = collectRouterProcedurePaths(orpcRouter);

    expect(contractPaths).toEqual([
      "signals.create",
      "signals.get",
      "system.health",
    ]);
    expect(routerPaths).toEqual(contractPaths);
  });
});
