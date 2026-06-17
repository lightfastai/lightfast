import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app/src");

describe("decision views TanStack migration", () => {
  it("exports decision view server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "api/app/package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/decision-views");
  });

  it("does not expose decision views over tRPC", () => {
    const decisionsRouterPath = resolve(
      apiRoot,
      "router/(pending-not-allowed)/decisions.ts"
    );

    if (existsSync(decisionsRouterPath)) {
      const decisionsRouterSource = readFileSync(decisionsRouterPath, "utf8");
      expect(decisionsRouterSource).not.toContain(
        "workspaceDecisionViewsRouter"
      );
      expect(decisionsRouterSource).not.toContain("views:");
    }

    expect(
      existsSync(
        resolve(
          apiRoot,
          "router/(pending-not-allowed)/workspace-decision-views.ts"
        )
      )
    ).toBe(false);
  });

  it("defines decision view server functions in the api/app adapter layer", () => {
    const adapterSource = readFileSync(
      resolve(apiRoot, "adapters/tanstack/decision-views.ts"),
      "utf8"
    );

    expect(adapterSource).toContain('from "@tanstack/react-start"');
    expect(adapterSource).toContain("createServerFn");
    expect(adapterSource).toContain("listDecisionViews");
    expect(adapterSource).not.toContain("TRPCError");
  });
});
