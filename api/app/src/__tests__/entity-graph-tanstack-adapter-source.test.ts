import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app");

describe("entity graph TanStack adapter boundary", () => {
  it("exports entity graph server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(apiRoot, "package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/entity-graph");
  });

  it("defines entity graph server functions in the adapter layer", () => {
    const source = readFileSync(
      resolve(apiRoot, "src/adapters/tanstack/entity-graph.ts"),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("listEntityPeopleCommand");
    expect(source).toContain("getEntityPersonCommand");
    expect(source).toContain("listEntityAccountsCommand");
    expect(source).toContain("getEntityAccountCommand");
    expect(source).toContain("ingestSimulatedEntityGraphCommand");
    expect(source).toContain("retrySignalEnrichmentCommand");
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
    expect(source).not.toContain('from "../../inngest/client"');
    expect(source).toContain('await import("../../inngest/client")');
  });
});
