import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("api/app app-facing tRPC root", () => {
  it("removes the final product tRPC router surface", () => {
    const packageJson = JSON.parse(source("../package.json")) as {
      dependencies?: Record<string, string>;
    };
    const trpcPath = resolve(apiRoot, "trpc.ts");
    const indexPath = resolve(apiRoot, "index.ts");
    const workspaceListInputPath = resolve(
      apiRoot,
      "router/(pending-not-allowed)/workspace-list-input.ts"
    );
    const taskRouterPath = resolve(
      apiRoot,
      "router/(pending-not-allowed)/task.ts"
    );

    expect(existsSync(trpcPath)).toBe(false);
    expect(existsSync(workspaceListInputPath)).toBe(false);
    expect(existsSync(taskRouterPath)).toBe(false);
    expect(existsSync(indexPath)).toBe(false);
    expect(packageJson.dependencies?.["@trpc/server"]).toBeUndefined();

    const rootSource = source("root.ts");
    expect(rootSource).not.toContain("createTRPCRouter");
    expect(rootSource).not.toContain("appRouter");
  });

  it("keeps service auth context imports independent of tRPC", () => {
    const identitySource = source("auth/identity.ts");

    expect(identitySource).not.toContain("tRPC");
    expect(identitySource).not.toContain("trpc");

    for (const file of [
      "services/connectors/index.ts",
      "services/connectors/linear-flow.ts",
      "services/connectors/x-flow.ts",
      "services/developer-connections/index.ts",
      "services/developer-sandbox-runs/index.ts",
    ]) {
      const fileSource = source(file);

      expect(fileSource, file).not.toContain("../../trpc");
      expect(fileSource, file).not.toContain("../trpc");
      expect(fileSource, file).toContain("../../auth/identity");
      expect(fileSource, file).toContain("ResolvedAuthContext");
    }

    for (const file of [
      "services/connectors/catalog.ts",
      "services/developer-connections/catalog.ts",
      "services/developer-connections/leases.ts",
      "services/user-connectors/catalog.ts",
      "services/user-connectors/granola-flow.ts",
      "services/user-connectors/index.ts",
    ]) {
      const fileSource = source(file);

      expect(fileSource, file).not.toContain("../../trpc");
      expect(fileSource, file).not.toContain("../trpc");
      expect(fileSource, file).not.toContain("../../auth/identity");
      expect(fileSource, file).not.toContain("ResolvedAuthContext");
    }

    const connectorCatalogSource = source("services/connectors/catalog.ts");
    for (const forbiddenToken of [
      "@vendor/clerk/server",
      "Headers",
      "getRequest",
      "request.headers",
      "headers:",
    ]) {
      expect(connectorCatalogSource, forbiddenToken).not.toContain(
        forbiddenToken
      );
    }
  });
});
