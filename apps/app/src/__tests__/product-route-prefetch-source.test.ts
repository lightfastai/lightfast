import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("app product route data prefetch", () => {
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

  it("does not turn unauthenticated protected-route prefetches into route-loader 500s", () => {
    const prefetchSource = source("src/trpc/route-prefetch.tsx");

    expect(prefetchSource).toContain("createEmptyPrefetchState");
    expect(prefetchSource).toContain("isUnauthorizedTRPCError");
    expect(prefetchSource).toContain("return createEmptyPrefetchState()");
    expect(prefetchSource).toContain('error.code === "UNAUTHORIZED"');
  });

  it("delegates route query recipes to feature-owned prefetch modules", () => {
    const prefetchSource = source("src/trpc/route-prefetch.tsx");
    const featurePrefetchFiles = [
      "src/account/account-route-prefetch.ts",
      "src/automations/automations-route-prefetch.ts",
      "src/connectors/connectors-route-prefetch.ts",
      "src/decisions/decisions-route-prefetch.ts",
      "src/developer-connections/developer-connections-route-prefetch.ts",
      "src/org/org-route-prefetch.ts",
      "src/people/people-route-prefetch.ts",
      "src/signals/signals-route-prefetch.ts",
      "src/skills/skills-route-prefetch.ts",
    ];

    for (const routePrefetchFile of featurePrefetchFiles) {
      expect(
        existsSync(resolve(appRoot, routePrefetchFile)),
        `${routePrefetchFile} should exist`
      ).toBe(true);
    }

    for (const modulePath of [
      "~/account/account-route-prefetch",
      "~/automations/automations-route-prefetch",
      "~/connectors/connectors-route-prefetch",
      "~/decisions/decisions-route-prefetch",
      "~/developer-connections/developer-connections-route-prefetch",
      "~/org/org-route-prefetch",
      "~/people/people-route-prefetch",
      "~/signals/signals-route-prefetch",
      "~/skills/skills-route-prefetch",
    ]) {
      expect(prefetchSource).toContain(modulePath);
    }

    expect(prefetchSource).not.toContain("PROCESSING_SIGNALS_LIMIT");
    expect(prefetchSource).not.toContain("DECISIONS_PAGE_SIZE");
    expect(prefetchSource).not.toContain("PEOPLE_PAGE_SIZE");
    expect(prefetchSource).not.toContain("AUTOMATION_RUNS_PAGE_LIMIT");
  });

  it("prefetches the non-chat product route queries owned by the migrated pages", () => {
    const prefetchSource = [
      source("src/automations/automations-route-prefetch.ts"),
      source("src/connectors/connectors-route-prefetch.ts"),
      source("src/decisions/decisions-route-prefetch.ts"),
      source(
        "src/developer-connections/developer-connections-route-prefetch.ts"
      ),
      source("src/org/org-route-prefetch.ts"),
      source("src/people/people-route-prefetch.ts"),
      source("src/signals/signals-route-prefetch.ts"),
      source("src/skills/skills-route-prefetch.ts"),
      source("src/account/account-route-prefetch.ts"),
    ].join("\n");

    for (const query of [
      "workingSetSignalsQueryOptions",
      "processingSignalsQueryOptions",
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
      "connectors.listSections.queryOptions",
      "connectors.list.queryOptions",
      "mcpConnections.list.queryOptions",
      "developerConnections.list.queryOptions",
      "viewer.account.mcpConnections.list.queryOptions",
    ]) {
      expect(prefetchSource).toContain(query);
    }
  });

  it("prefetches settings and account task route queries owned by migrated pages", () => {
    const prefetchSource = [
      source("src/account/account-route-prefetch.ts"),
      source("src/org/org-route-prefetch.ts"),
    ].join("\n");

    for (const query of [
      "org.settings.identity.get.queryOptions",
      "org.settings.organization.listDomains.queryOptions",
      "org.settings.orgApiKeys.list.queryOptions",
      "org.settings.orgMembers.list.queryOptions",
      "org.settings.sourceControl.listRepositories.queryOptions",
      "org.settings.orgBilling.overview.queryOptions",
      "viewer.githubAccount.status.queryOptions",
      "viewer.account.get.queryOptions",
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
      "src/routes/_authenticated/$slug/tasks/connectors/x/index.tsx",
      "src/routes/_authenticated/$slug/settings/mcp.tsx",
      "src/routes/_authenticated/account/mcp.tsx",
      "src/routes/_authenticated/$slug/settings/general.tsx",
      "src/routes/_authenticated/$slug/settings/source-control.tsx",
      "src/routes/_authenticated/$slug/settings/members.tsx",
      "src/routes/_authenticated/$slug/settings/billing.tsx",
      "src/routes/_authenticated/$slug/settings/api-keys.tsx",
      "src/routes/_authenticated/account/settings/general.tsx",
      "src/routes/_authenticated/account/settings/source-control.tsx",
      "src/routes/_authenticated/account/tasks/github/index.tsx",
      "src/routes/_authenticated/account/tasks/username.tsx",
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

  it("hydrates people and decisions with the active route search params", () => {
    const peopleRouteSource = source(
      "src/routes/_authenticated/$slug/people.tsx"
    );
    const decisionsRouteSource = source(
      "src/routes/_authenticated/$slug/decisions.tsx"
    );
    const prefetchSource = source("src/trpc/route-prefetch.tsx");

    expect(peopleRouteSource).toContain("loaderDeps:");
    expect(peopleRouteSource).toContain("peopleQuery: search.peopleQuery");
    expect(peopleRouteSource).toContain("provider: search.provider");
    expect(peopleRouteSource).toContain("type: search.type");
    expect(peopleRouteSource).toContain("...deps");

    expect(decisionsRouteSource).toContain("loaderDeps:");
    expect(decisionsRouteSource).toContain("provider: search.provider");
    expect(decisionsRouteSource).toContain("q: search.q");
    expect(decisionsRouteSource).toContain("status: search.status");
    expect(decisionsRouteSource).toContain("...deps");

    expect(prefetchSource).toContain("peopleQuery?: string");
    expect(prefetchSource).toContain("provider?: string");
    expect(prefetchSource).toContain("status?: string");
    expect(prefetchSource).toContain("prefetchPeopleRoute(prefetchContext,");
    expect(prefetchSource).toContain("prefetchDecisionsRoute(prefetchContext,");
  });
});
