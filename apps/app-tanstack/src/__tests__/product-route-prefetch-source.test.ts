import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("app-tanstack product route data prefetch", () => {
  it("keeps authenticated tRPC prefetching behind a TanStack server function", () => {
    const prefetchSource = source("src/trpc/route-prefetch.tsx");

    expect(prefetchSource).toContain("createServerFn");
    expect(prefetchSource).toContain('import("@tanstack/react-start/server")');
    expect(prefetchSource).toContain('import("@api/app")');
    expect(prefetchSource).toContain("createTRPCOptionsProxy");
    expect(prefetchSource).toContain("getRequest()");
    expect(prefetchSource).toContain('"x-trpc-source"');
    expect(prefetchSource).toContain("HydrationBoundary");
    expect(prefetchSource).not.toContain('from "@api/app"');
    expect(prefetchSource).not.toContain("next/");
  });

  it("prefetches the non-chat product route queries owned by the migrated pages", () => {
    const prefetchSource = source("src/trpc/route-prefetch.tsx");

    for (const query of [
      "signals.workingSet.queryOptions",
      "signals.list.queryOptions",
      "signals.views.list.queryOptions",
      "automations.list.queryOptions",
      "automations.get.queryOptions",
      "automations.listRuns.queryOptions",
      "decisions.list.infiniteQueryOptions",
      "decisions.views.list.queryOptions",
      "people.list.infiniteQueryOptions",
      "people.views.list.queryOptions",
      "skills.list.queryOptions",
      "viewer.organization.getBySlug.queryOptions",
      "sourceControl.get.queryOptions",
      "connectors.list.queryOptions",
      "mcpConnections.list.queryOptions",
      "developerConnections.list.queryOptions",
      "viewer.account.mcpConnections.list.queryOptions",
    ]) {
      expect(prefetchSource).toContain(query);
    }
  });

  it("wires product pages through route loaders and hydration boundaries", () => {
    const routeFiles = [
      "src/routes/_authenticated/$slug/signals.tsx",
      "src/routes/_authenticated/$slug/automations/index.tsx",
      "src/routes/_authenticated/$slug/automations/new.tsx",
      "src/routes/_authenticated/$slug/automations/$automation.tsx",
      "src/routes/_authenticated/$slug/connectors.tsx",
      "src/routes/_authenticated/$slug/decisions.tsx",
      "src/routes/_authenticated/$slug/developer-connections.tsx",
      "src/routes/_authenticated/$slug/people.tsx",
      "src/routes/_authenticated/$slug/skills.tsx",
      "src/routes/_authenticated/$slug/tasks/index.tsx",
      "src/routes/_authenticated/$slug/tasks/bind/index.tsx",
      "src/routes/_authenticated/$slug/tasks/github/lightfast-repo.tsx",
      "src/routes/_authenticated/$slug/tasks/connectors/x.tsx",
      "src/routes/_authenticated/$slug/settings/mcp.tsx",
      "src/routes/_authenticated/account/mcp.tsx",
    ];

    for (const routeFile of routeFiles) {
      expect(
        existsSync(resolve(appRoot, routeFile)),
        `${routeFile} should exist`
      ).toBe(true);
      const routeSource = source(routeFile);
      expect(routeSource).toContain("loadRoutePrefetch");
      expect(routeSource).toContain("RoutePrefetchBoundary");
      expect(routeSource).toContain("loader:");
    }
  });

  it("keeps automation creation parity with connector-aware Next form data", () => {
    const formSource = source("src/automations/automation-create-form.tsx");
    const packageSource = source("package.json");

    expect(packageSource).toContain(
      '"@repo/connector-contract": "workspace:*"'
    );
    expect(formSource).toContain("connectableConnectorProviderSchema");
    expect(formSource).toContain("connectors.list.queryOptions");
    expect(formSource).toContain("availableForAutomations");
    expect(formSource).toContain("connectorProvider");
    expect(formSource).toContain("No connector");
  });
});
