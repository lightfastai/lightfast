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
    expect(teamSwitcherSource).toContain("function TeamSwitcherSlot()");
    expect(teamSwitcherSource).toContain("<TeamSwitcherSkeleton />");
    expect(shellSource).toContain(
      "<AuthenticatedTopbar left={<TeamSwitcherSlot />} />"
    );
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
    expect(orgRouteSource).toContain("orgSetupExemptPath");
    expect(orgRouteSource).toContain("SetupRequirementNavigate");
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

  it("ports Signals without Next.js search or link assumptions", () => {
    const routeSource = source("src/routes/_authenticated/$slug/signals.tsx");
    const clientSource = source("src/signals/signals-client.tsx");
    const createDialogSource = source("src/signals/signal-create-dialog.tsx");
    const searchSource = source("src/signals/signals-search-params.ts");
    const querySource = source("src/signals/use-classified-signals-query.ts");

    expect(routeSource).toContain("validateSignalsSearch");
    expect(routeSource).toContain("createFileRoute");
    expect(routeSource).toContain("SIGNAL_FILTER_SEARCH_KEYS");
    expect(clientSource).toContain("SignalCreateDialog");
    expect(clientSource).toContain("signals.get.queryOptions");
    expect(createDialogSource).toContain("signals.create.mutationOptions");
    expect(createDialogSource).toContain("listUserOrganizations.queryOptions");
    expect(searchSource).toContain("validateSignalsSearch");
    expect(searchSource).toContain("parseSignalDispositions");
    expect(querySource).toContain("signals.workingSet.queryOptions");
    expect(querySource).toContain("signals.list.queryOptions");
    expect(querySource).toContain('enabled: typeof window !== "undefined"');

    for (const routeFile of [
      routeSource,
      clientSource,
      createDialogSource,
      searchSource,
    ]) {
      expect(routeFile).not.toContain("next/");
      expect(routeFile).not.toContain("nuqs");
      expect(routeFile).not.toContain("workspace-command-menu");
      expect(routeFile).not.toContain("@vercel/microfrontends/next");
    }
  });

  it("ports org setup routes and GitHub callbacks", () => {
    const orgRouteSource = source("src/routes/_authenticated/$slug.tsx");
    const bindRouteSource = source(
      "src/routes/_authenticated/$slug/tasks/bind.tsx"
    );
    const lightfastRepoRouteSource = source(
      "src/routes/_authenticated/$slug/tasks/github/lightfast-repo.tsx"
    );
    const completeRouteSource = source(
      "src/routes/_authenticated/$slug/tasks/bind/github/complete.tsx"
    );
    const bindCardSource = source("src/org/setup/bind-github-card.tsx");
    const repoClientSource = source(
      "src/org/setup/lightfast-repo-setup-client.tsx"
    );
    const setupCallbackSource = source("src/routes/api/github/setup.ts");
    const oauthCallbackSource = source(
      "src/routes/api/github/oauth/callback.ts"
    );

    expect(orgRouteSource).toContain('bindingStatus !== "bound"');
    expect(orgRouteSource).toContain(
      "<AuthenticatedTopbar left={<TeamSwitcherSlot />} />"
    );
    expect(orgRouteSource).toContain('to="/$slug/tasks/bind"');
    expect(orgRouteSource).toContain('to="/$slug/tasks/github/lightfast-repo"');
    expect(bindRouteSource).toContain("githubBindErrorCodeSchema");
    expect(bindRouteSource).toContain("BindGithubCard");
    expect(bindCardSource).toContain("org.setup.github.start");
    expect(lightfastRepoRouteSource).toContain(
      "org.settings.sourceControl.get"
    );
    expect(lightfastRepoRouteSource).toContain("newLightfastRepositoryUrl");
    expect(lightfastRepoRouteSource).not.toContain("getGitHubNewRepositoryUrl");
    expect(repoClientSource).toContain("verifyLightfastRepo");
    expect(repoClientSource).toContain("newRepositoryUrl");
    expect(repoClientSource).not.toContain("https://github.com");
    expect(completeRouteSource).toContain("GitHubBindCompleteClient");
    expect(setupCallbackSource).toContain("completeGitHubInstallationSetup");
    expect(oauthCallbackSource).toContain("completeGitHubOAuthVerification");

    for (const routeFile of [
      bindRouteSource,
      lightfastRepoRouteSource,
      completeRouteSource,
      bindCardSource,
      repoClientSource,
    ]) {
      expect(routeFile).not.toContain("next/");
    }
  });
});
