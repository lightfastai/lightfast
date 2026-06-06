import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("app-tanstack authenticated route migration", () => {
  it("mounts the tRPC React Query provider at the root route", () => {
    const rootSource = source("src/routes/__root.tsx");
    const trpcSource = source("src/trpc/react.tsx");

    expect(rootSource).toContain("<TRPCReactProvider>");
    expect(trpcSource).toContain("createTRPCContext<AppRouter>");
    expect(trpcSource).toContain("url:");
    expect(trpcSource).toContain("/api/trpc");
    expect(trpcSource).toContain(
      "Server-side tRPC React fetches require request-aware auth wiring."
    );
    expect(trpcSource).toContain(
      'credentials: sameOrigin ? "include" : "omit"'
    );
    expect(trpcSource).not.toContain('from "~/env"');
  });

  it("ports team creation without Next.js router imports", () => {
    const routeSource = source(
      "src/routes/_authenticated/account/teams/new.tsx"
    );

    expect(routeSource).toContain("viewer.organization.create");
    expect(routeSource).toContain("normalizeTeamSlug");
    expect(routeSource).toContain("createTeamIdempotencyKey");
    expect(routeSource).toContain(
      "setActive({ organization: data.organizationId })"
    );
    expect(routeSource).toContain('await navigate({ to: "/$slug"');
    expect(routeSource).toContain('id="teamSlug"');
    expect(routeSource).toContain("lightfast.ai/");
    expect(routeSource).not.toContain("next/navigation");
    expect(routeSource).not.toContain("next/link");
  });

  it("uses a pathless authenticated shell for account and org routes", () => {
    const shellSource = source("src/routes/_authenticated.tsx");
    const teamSwitcherSource = source("src/components/team-switcher.tsx");
    const appSidebarSource = source("src/components/app-sidebar.tsx");
    const orgRouteSource = source("src/routes/_authenticated/$slug.tsx");
    const conversationRouteSource = source(
      "src/routes/_authenticated/$slug/chat/$conversationId.tsx"
    );

    expect(shellSource).toContain('createFileRoute("/_authenticated")');
    expect(shellSource).toContain('to: "/sign-in"');
    expect(shellSource).toContain("redirect_url: location.href");
    expect(shellSource).toContain("AUTH_ROUTE_PATHS");
    expect(shellSource).toContain("isAuthRoute");
    expect(teamSwitcherSource).toContain(
      "listUserOrganizations.queryOptions()"
    );
    expect(teamSwitcherSource).toContain('to="/account/teams/new"');
    expect(teamSwitcherSource).toContain('to="/$slug"');
    expect(teamSwitcherSource).not.toContain("next/navigation");
    expect(teamSwitcherSource).not.toContain("next/link");
    expect(appSidebarSource).toContain("listConversations.queryOptions");
    expect(appSidebarSource).toContain('to="/$slug/chat/$conversationId"');
    expect(orgRouteSource).toContain("getBySlug.queryOptions({ slug })");
    expect(orgRouteSource).toContain("Team not found");
    expect(orgRouteSource).not.toContain("organization?.name ?? slug");
    expect(conversationRouteSource).toContain("createFileRoute");
    expect(conversationRouteSource).toContain(
      '"/_authenticated/$slug/chat/$conversationId"'
    );
  });

  it("serves app fonts from a proxy-safe TanStack path", () => {
    const globalCss = source("src/styles/globals.css");

    expect(globalCss).toContain("/app-tanstack/fonts/geist/Geist-Variable");
    expect(globalCss).toContain(
      "/app-tanstack/fonts/pp-neue-montreal/PPNeueMontreal-Medium"
    );
    expect(globalCss).not.toContain('url("/fonts/');
  });
});
