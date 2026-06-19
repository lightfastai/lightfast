import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = resolve(import.meta.dirname, "..");
const apiRoot = resolve(srcRoot, "..");

describe("workspace entity graph transport surfaces", () => {
  it("keeps entity graph out of app RPC surfaces", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(apiRoot, "package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };
    const routerPath = resolve(
      srcRoot,
      "router/(pending-not-allowed)/workspace-entity-graph.ts"
    );
    const tanstackAdapterPath = resolve(
      srcRoot,
      "adapters/tanstack/entity-graph.ts"
    );
    const domainCommandsPath = resolve(
      srcRoot,
      "domain/entity-graph/commands.ts"
    );
    const domainIndexPath = resolve(srcRoot, "domain/entity-graph/index.ts");
    const domainIndexSource = readFileSync(
      resolve(srcRoot, "domain/index.ts"),
      "utf8"
    );

    expect(existsSync(routerPath)).toBe(false);
    expect(existsSync(tanstackAdapterPath)).toBe(false);
    expect(existsSync(domainCommandsPath)).toBe(false);
    expect(existsSync(domainIndexPath)).toBe(false);
    expect(existsSync(resolve(srcRoot, "root.ts"))).toBe(false);
    expect(packageJson.exports).not.toHaveProperty("./tanstack/entity-graph");
    expect(domainIndexSource).not.toContain("./entity-graph");
  });
});
