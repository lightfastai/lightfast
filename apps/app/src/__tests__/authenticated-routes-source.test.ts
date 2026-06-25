import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(appRoot, "../..");
const oldProviderRoutinesPackage = `@repo/${"provider-routines"}`;

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function repoSource(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function expectSource(path: string) {
  expect(existsSync(resolve(appRoot, path)), `${path} should exist`).toBe(true);
  return source(path);
}

function appSourceFiles(dir = resolve(appRoot, "src")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "__tests__") {
        return [];
      }

      return appSourceFiles(absPath);
    }

    return /\.(?:ts|tsx)$/.test(entry.name) ? [absPath] : [];
  });
}

const internalApiRouteLazyImportExpectations = [
  {
    handlerName: "handleGitHubWebhookRequest",
    moduleSpecifier: "@api/app/internal-api/github-webhook",
    path: "src/routes/api/github/webhook.ts",
    staticImport:
      'import { handleGitHubWebhookRequest } from "@api/app/internal-api/github-webhook"',
  },
  {
    handlerName: "handleGitHubInstallationSetupRequest",
    moduleSpecifier: "@api/app/internal-api/github-oauth",
    path: "src/routes/api/github/setup.ts",
    staticImport:
      'import { handleGitHubInstallationSetupRequest } from "@api/app/internal-api/github-oauth"',
  },
  {
    handlerName: "handleGitHubOAuthCallbackRequest",
    moduleSpecifier: "@api/app/internal-api/github-oauth",
    path: "src/routes/api/github/oauth/callback.ts",
    staticImport:
      'import { handleGitHubOAuthCallbackRequest } from "@api/app/internal-api/github-oauth"',
  },
  {
    handlerName: "handleGitHubUserAccountOAuthCallbackRequest",
    moduleSpecifier: "@api/app/internal-api/github-oauth",
    path: "src/routes/api/github/user/oauth/callback.ts",
    staticImport:
      'import { handleGitHubUserAccountOAuthCallbackRequest } from "@api/app/internal-api/github-oauth"',
  },
  {
    handlerName: "handleXConnectorMcpRequest",
    moduleSpecifier: "@api/app/internal-api/connector-mcp",
    path: "src/routes/api/connectors/x/mcp.ts",
    staticImport:
      'import { handleXConnectorMcpRequest } from "@api/app/internal-api/connector-mcp"',
  },
  {
    handlerName: "handleXConnectorOAuthCallbackRequest",
    moduleSpecifier: "@api/app/internal-api/connector-oauth",
    path: "src/routes/api/connectors/x/oauth/callback.ts",
    staticImport:
      'import { handleXConnectorOAuthCallbackRequest } from "@api/app/internal-api/connector-oauth"',
  },
  {
    handlerName: "handleLinearConnectorOAuthCallbackRequest",
    moduleSpecifier: "@api/app/internal-api/connector-oauth",
    path: "src/routes/api/connectors/linear/oauth/callback.ts",
    staticImport:
      'import { handleLinearConnectorOAuthCallbackRequest } from "@api/app/internal-api/connector-oauth"',
  },
  {
    handlerName: "handleGranolaUserConnectorOAuthCallbackRequest",
    moduleSpecifier: "@api/app/internal-api/connector-oauth",
    path: "src/routes/api/connectors/granola/oauth/callback.ts",
    staticImport:
      'import { handleGranolaUserConnectorOAuthCallbackRequest } from "@api/app/internal-api/connector-oauth"',
  },
] as const;

describe("app authenticated route migration", () => {
  it("mounts a plain TanStack Query provider at the root route", () => {
    const rootSource = source("src/routes/__root.tsx");
    const querySource = expectSource("src/query/react.tsx");

    expect(rootSource).toContain("<QueryProvider>");
    expect(rootSource).toContain('from "~/query/react"');
    expect(rootSource).not.toContain("TRPCReactProvider");
    expect(rootSource).not.toContain('from "~/trpc/react"');
    expect(querySource).toContain("QueryClientProvider");
    expect(querySource).toContain("MutationCache");
    expect(querySource).toContain("isExpectedDomainError");
    expect(querySource).toContain('error.name === "DomainError"');
    expect(querySource).not.toContain("@trpc/");
    expect(querySource).not.toContain("/api/trpc");
    expect(querySource).not.toContain("AppRouter");
    expect(querySource).not.toContain('from "~/env"');
  });

  it("ports team creation without Next.js router imports", () => {
    const routeSource = source(
      "src/routes/_authenticated/account/teams/new.tsx"
    );
    const clientSource = source("src/account/team-create-client.tsx");

    expect(routeSource).toContain(
      'createFileRoute("/_authenticated/account/teams/new")'
    );
    expect(routeSource).toContain("CreateTeamClient");
    expect(clientSource).toContain('@api/app/tanstack/organizations"');
    expect(clientSource).toContain("createOrganization");
    expect(clientSource).not.toContain("createOrganizationMutationOptions");
    expect(clientSource).toContain("organizationQueryKeys");
    expect(clientSource).toContain("normalizeTeamSlug");
    expect(clientSource).toContain("createTeamIdempotencyKey");
    expect(clientSource).toContain(
      "setActive({ organization: data.organizationId })"
    );
    expect(clientSource).toContain('await navigate({ to: "/$slug"');
    expect(clientSource).toContain('id="teamSlug"');
    expect(clientSource).toContain("lightfast.ai/");
    expect(routeSource).not.toContain("next/navigation");
    expect(routeSource).not.toContain("next/link");
    expect(clientSource).not.toContain("next/navigation");
    expect(clientSource).not.toContain("next/link");
  });

  it("ports invitation acceptance without Next.js auth route imports", () => {
    const routeSource = source("src/routes/sign-up_.accept-invitation.tsx");

    expect(routeSource).toContain(
      'createFileRoute("/sign-up_/accept-invitation")'
    );
    expect(routeSource).toContain("/sign-up/accept-invitation?");
    expect(routeSource).toContain("validateAcceptInvitationSearch");
    expect(routeSource).toContain("__clerk_ticket");
    expect(routeSource).toContain('strategy: "ticket"');
    expect(routeSource).toContain("legalAccepted: true");
    expect(routeSource).toContain("makeFinalizeNavigate");
    expect(routeSource).toContain("ErrorBanner");
    expect(routeSource).toContain("clerk-captcha");
    expect(routeSource).not.toContain("next/");
    expect(routeSource).not.toContain("@vercel/microfrontends/next");
    expect(routeSource).not.toContain('"use client"');
  });

  it("ports OAuth auth-boundary pages without Next.js route primitives", () => {
    const authorizeRouteSource = source("src/routes/oauth/authorize.tsx");
    const consentCardSource = source("src/oauth/mcp-consent-card.tsx");
    const consentFunctionsPath = resolve(
      appRoot,
      "src/oauth/mcp-consent-functions.ts"
    );
    const consentServerPath = resolve(
      appRoot,
      "src/oauth/mcp-consent.server.ts"
    );
    const consentAdapterSource = repoSource(
      "api/app/src/adapters/tanstack/mcp-consent.ts"
    );
    const nativeRouteSource = source("src/routes/oauth/$client/start.tsx");
    const nativeOrgSelectSource = source(
      "src/oauth/native-auth-org-select.tsx"
    );
    const nativeFunctionsPath = resolve(
      appRoot,
      "src/oauth/native-auth-functions.ts"
    );
    const nativeAdapterSource = repoSource(
      "api/app/src/adapters/tanstack/native-auth.ts"
    );
    const nativeValidatorsSource = source(
      "src/oauth/native-auth-validators.ts"
    );

    expect(authorizeRouteSource).toContain(
      'createFileRoute("/oauth/authorize")'
    );
    expect(authorizeRouteSource).toContain("loadMcpConsentViewModel");
    expect(authorizeRouteSource).toContain(
      'from "@api/app/tanstack/mcp-consent"'
    );
    expect(authorizeRouteSource).toContain(
      'value.some((item) => typeof item !== "string" || item.length === 0)'
    );
    expect(consentCardSource).toContain("useServerFn");
    expect(consentCardSource).toContain("approveMcpAuthorization");
    expect(consentCardSource).toContain("denyMcpAuthorization");
    expect(consentCardSource).toContain('from "@api/app/tanstack/mcp-consent"');
    expect(consentCardSource).toContain("window.location.assign(redirectUrl)");
    expect(consentCardSource).toContain('method="post"');
    expect(consentCardSource).toContain("event.preventDefault();");
    expect(consentCardSource).toContain('void submitAuthorization("approve");');
    expect(consentCardSource).toMatch(
      /onClick=\{\(\) => void submitAuthorization\("approve"\)\}[\s\S]*?type="button"/
    );
    expect(existsSync(consentFunctionsPath)).toBe(false);
    expect(existsSync(consentServerPath)).toBe(false);
    expect(consentAdapterSource).toContain(
      "export const loadMcpConsentViewModel = createServerFn"
    );
    expect(consentAdapterSource).toContain(
      "export const approveMcpAuthorization = createServerFn"
    );
    expect(consentAdapterSource).toContain(
      "export const denyMcpAuthorization = createServerFn"
    );
    expect(consentAdapterSource).toContain("oauthRequestRedirectTarget");
    expect(consentAdapterSource).toContain("issueMcpAuthorizationCode");
    expect(consentAdapterSource).toContain("requireUserOrgMembership");

    expect(nativeRouteSource).toContain(
      'createFileRoute("/oauth/$client/start")'
    );
    expect(nativeRouteSource).toContain("validateNativeAuthStartSearch");
    expect(nativeRouteSource).toContain("loadNativeAuthOrganizations");
    expect(nativeRouteSource).toContain('from "@api/app/tanstack/native-auth"');
    expect(nativeRouteSource).not.toContain("~/oauth/native-auth-functions");
    expect(nativeRouteSource).toContain("NativeAuthOrgSelect");
    expect(nativeOrgSelectSource).toContain('@api/app/tanstack/native-auth"');
    expect(nativeOrgSelectSource).toContain("createNativeAuthAttempt");
    expect(nativeOrgSelectSource).not.toContain("useTRPC");
    expect(nativeOrgSelectSource).not.toContain("native.auth");
    expect(nativeOrgSelectSource).toContain("withClerkDevBrowserContext");
    expect(existsSync(nativeFunctionsPath)).toBe(false);
    expect(nativeAdapterSource).toContain(
      "export const loadNativeAuthOrganizations = createServerFn"
    );
    expect(nativeAdapterSource).toContain("oauthRequestRedirectTarget");
    expect(nativeAdapterSource).toContain('to: "/sign-in"');
    expect(nativeValidatorsSource).toContain("isLoopbackRedirectUri");

    for (const routeFile of [
      authorizeRouteSource,
      consentCardSource,
      nativeRouteSource,
      nativeOrgSelectSource,
      nativeValidatorsSource,
    ]) {
      expect(routeFile).not.toContain("next/");
      expect(routeFile).not.toContain('"use client"');
      expect(routeFile).not.toContain('"use server"');
    }
  });

  it("uses a pathless authenticated shell for account and org routes", () => {
    const shellSource = source("src/routes/_authenticated.tsx");
    const authenticatedLayoutModelPath = resolve(
      appRoot,
      "src/components/authenticated-layout-model.ts"
    );
    const teamSwitcherSource = source("src/components/team-switcher.tsx");
    const appSidebarSource = source("src/components/app-sidebar.tsx");
    const recentChatsMenuSource = source(
      "src/components/recent-chats-menu.tsx"
    );
    const orgRouteSource = source("src/routes/_authenticated/$slug.tsx");
    const workspaceShellSource = source(
      "src/workspace/workspace-route-shell.tsx"
    );
    const workspaceModelSource = source(
      "src/workspace/workspace-route-model.ts"
    );
    const conversationRouteSource = source(
      "src/routes/_authenticated/$slug/chat/$conversationId.tsx"
    );

    expect(shellSource).toContain('createFileRoute("/_authenticated")');
    expect(shellSource).toContain(
      'import { useUser } from "@clerk/tanstack-react-start"'
    );
    expect(shellSource).toContain("const { isLoaded, isSignedIn } = useUser()");
    expect(shellSource).not.toContain(
      "const { isLoaded, isSignedIn } = useAuth()"
    );
    expect(shellSource).toContain('to: "/sign-in"');
    expect(shellSource).toContain("redirect_url: location.href");
    expect(shellSource).toContain("AUTH_ROUTE_PATHS");
    expect(shellSource).toContain("isAuthRoute");
    expect(existsSync(authenticatedLayoutModelPath)).toBe(false);
    expect(shellSource).not.toContain("authenticated-layout-model");
    expect(shellSource).toContain(
      'const BASIC_SHELL_PREFIXES = ["/account", "/accounts"] as const'
    );
    expect(shellSource).toContain("const usesBasicShell");
    expect(shellSource).toContain("if (!usesBasicShell)");
    expect(teamSwitcherSource).toContain("function TeamSwitcherSlot()");
    expect(teamSwitcherSource).toContain("<TeamSwitcherSkeleton />");
    expect(teamSwitcherSource).toContain('from "@repo/ui/hooks/use-mounted"');
    expect(teamSwitcherSource).toContain(
      'from "@repo/ui-v2/components/ui/dropdown-menu"'
    );
    expect(teamSwitcherSource).not.toContain(
      'from "@repo/ui/components/ui/dropdown-menu"'
    );
    expect(teamSwitcherSource).toContain(
      'from "@repo/ui-v2/components/ui/avatar"'
    );
    expect(teamSwitcherSource).not.toContain(
      'from "@repo/ui/components/ui/avatar"'
    );
    expect(teamSwitcherSource).toContain(
      "bg-foreground text-[10px] text-background"
    );
    expect(teamSwitcherSource).not.toContain("!text-background");
    expect(teamSwitcherSource).not.toContain("asChild");
    expect(teamSwitcherSource).toContain("const mounted = useMounted();");
    expect(teamSwitcherSource).toContain("if (!mounted || isPending)");
    expect(shellSource).not.toContain("AuthenticatedTopbar");
    expect(shellSource).not.toContain("Docs");
    expect(shellSource).not.toContain("API Reference");
    expect(teamSwitcherSource).toContain("listUserOrganizations()");
    expect(teamSwitcherSource).toContain("organizationQueryKeys.list()");
    expect(teamSwitcherSource).toContain(
      '<DropdownMenuContent align="center" size="sm">'
    );
    expect(teamSwitcherSource).toContain(
      'from "@repo/ui-v2/components/ui/button"'
    );
    expect(teamSwitcherSource).not.toContain(
      'from "@repo/ui/components/ui/button"'
    );
    expect(teamSwitcherSource).toContain('aria-label="Switch team"');
    expect(teamSwitcherSource).toContain('className="ml-auto"');
    expect(teamSwitcherSource).toContain('size="icon-sm"');
    expect(teamSwitcherSource).toContain('type="button"');
    expect(teamSwitcherSource).toContain('variant="ghost"');
    expect(teamSwitcherSource).toMatch(
      /render=\{\s*<Button\s+aria-label="Switch team"[\s\S]*?className="ml-auto"[\s\S]*?type="button"[\s\S]*?variant="ghost"\s*\/>\s*\}[\s\S]*?>\s*<HugeiconsIcon\s+aria-hidden="true"\s+className="size-4"\s+icon=\{UnfoldMoreIcon\}\s*\/>\s*<\/DropdownMenuTrigger>/
    );
    expect(teamSwitcherSource).not.toContain('className="size-11 rounded-full');
    expect(teamSwitcherSource).not.toContain(
      '<DropdownMenuContent align="center" className='
    );
    expect(teamSwitcherSource).toContain('to="/account/teams/new"');
    expect(teamSwitcherSource).toContain('to="/$slug"');
    expect(teamSwitcherSource).not.toContain("next/navigation");
    expect(teamSwitcherSource).not.toContain("next/link");
    expect(recentChatsMenuSource).toContain("listConversations");
    expect(recentChatsMenuSource).toContain(
      '"workspace-assistant",\n      "conversations",\n      orgSlug,\n      recentChatsInput'
    );
    expect(recentChatsMenuSource).not.toContain(
      "assistantConversationsQueryOptions"
    );
    expect(recentChatsMenuSource).toContain('to="/$slug/chat/$conversationId"');
    expect(appSidebarSource).not.toContain("showChatHistory");
    expect(orgRouteSource).toContain("WorkspaceRouteShell");
    expect(workspaceShellSource).toContain("getOrganizationBySlug");
    expect(workspaceShellSource).toContain(
      "organizationQueryKeys.bySlug(slug)"
    );
    expect(workspaceShellSource).toContain("useAuth");
    expect(workspaceShellSource).toContain("useOrganizationList");
    expect(workspaceShellSource).toContain("orgAccess.org.id");
    expect(workspaceShellSource).toContain(
      "setActive({ organization: targetOrgId })"
    );
    expect(workspaceShellSource).toContain("isOrgSetupExemptPath");
    expect(workspaceShellSource).toContain("SetupRequirementNavigate");
    expect(workspaceShellSource).toContain(
      'orgAccess.bindingStatus === "bound"'
    );
    expect(workspaceShellSource).not.toContain("showChatHistory");
    expect(workspaceShellSource).not.toContain(
      "shouldShowWorkspaceChatHistory"
    );
    expect(workspaceModelSource).not.toContain(
      "shouldShowWorkspaceChatHistory"
    );
    expect(workspaceModelSource).toContain("isOrgSettingsPath");
    expect(workspaceShellSource).toContain("Team not found");
    expect(workspaceShellSource).not.toContain("organization?.name ?? slug");
    expect(conversationRouteSource).toContain("createFileRoute");
    expect(conversationRouteSource).toContain(
      '"/_authenticated/$slug/chat/$conversationId"'
    );
  });

  it("serves app fonts from a proxy-safe TanStack path", () => {
    const globalCss = source("src/styles/globals.css");

    expect(globalCss).toContain("/app/fonts/geist/Geist-Variable");
    expect(globalCss).toContain(
      "/app/fonts/pp-neue-montreal/PPNeueMontreal-Medium"
    );
    expect(globalCss).not.toContain('url("/fonts/');
  });

  it("uses app-owned ui-v2 CSS primitives while keeping migration hooks", () => {
    const globalCss = source("src/styles/globals.css");
    const postcssConfig = source("postcss.config.mjs");

    expect(globalCss).toContain('@import "tailwindcss/index.css";');
    expect(globalCss).toContain('@import "@repo/ui-v2/shadcn.css";');
    expect(globalCss).toContain('@import "@repo/ui-v2/theme.css";');
    expect(globalCss).toContain('@import "@repo/ui-v2/ai-elements.css";');
    expect(globalCss).not.toContain('@import "@repo/ui-v2/globals.css";');
    expect(globalCss).not.toContain('@import "@repo/ui/globals.css";');
    expect(globalCss).toContain('@source "../**/*.{ts,tsx}";');
    expect(globalCss).toContain(
      '@source "../../../../packages/ui/src/**/*.{ts,tsx}";'
    );
    expect(globalCss).toContain(
      '@source "../../../../packages/ui-v2/src/**/*.{ts,tsx}";'
    );
    expect(globalCss).toContain("--font-geist-sans");
    expect(globalCss).toContain("--font-pp-neue-montreal");
    expect(globalCss).not.toContain(".font-pp");
    expect(postcssConfig).toContain("@repo/ui-v2/postcss.config");
    expect(postcssConfig).not.toContain("@repo/ui/postcss.config");
  });

  it("keeps ui-v2 dropdown focused items from overriding composed child colors", () => {
    const dropdownMenuSource = repoSource(
      "packages/ui-v2/src/components/ui/dropdown-menu.tsx"
    );

    expect(dropdownMenuSource).toContain(
      "focus:bg-accent focus:text-accent-foreground"
    );
    expect(dropdownMenuSource).not.toContain("focus:**:text-accent-foreground");
  });

  it("keeps ui-v2 select content padded once for grouped and ungrouped lists", () => {
    const selectSource = repoSource(
      "packages/ui-v2/src/components/ui/select.tsx"
    );
    const selectPopupClass =
      selectSource.match(
        /<SelectPrimitive\.Popup[\s\S]*?className=\{cn\(\s*"([^"]+)"/
      )?.[1] ?? "";
    const selectGroupClass =
      selectSource.match(
        /<SelectPrimitive\.Group[\s\S]*?className=\{cn\("([^"]+)"/
      )?.[1] ?? "";
    const selectListClass =
      selectSource.match(/<SelectPrimitive\.List\s+className="([^"]+)"/)?.[1] ??
      "";
    const legacySelectSource = repoSource(
      "packages/ui/src/components/ui/select.tsx"
    );
    const legacyViewportClass =
      legacySelectSource.match(
        /<SelectPrimitive\.Viewport[\s\S]*?className=\{cn\(\s*"([^"]+)"/
      )?.[1] ?? "";

    expect(legacyViewportClass.split(/\s+/)).toContain("p-[5px]");
    expect(selectListClass.split(/\s+/)).toContain("p-1");
    expect(selectPopupClass.split(/\s+/)).not.toContain("p-1");
    expect(selectGroupClass.split(/\s+/)).not.toContain("p-1");
  });

  it("uses the ui-v2 dropdown menu everywhere in app source", () => {
    const legacyDropdownImport = "@repo/ui/components/ui/dropdown-menu";
    const offenders = appSourceFiles()
      .filter((file) =>
        readFileSync(file, "utf8").includes(legacyDropdownImport)
      )
      .map((file) => file.slice(appRoot.length + 1));

    expect(offenders).toEqual([]);
  });

  it("uses ui-v2 select instead of the removed custom lf-select", () => {
    const formerLfSelectCallers = [
      "src/automations/automation-create-form.tsx",
      "src/automations/automation-schedule-editor.tsx",
      "src/connectors/connectors-client.tsx",
      "src/org/settings/source-control/repository-list.tsx",
      "src/skills/skills-client.tsx",
    ];
    const importOffenders = appSourceFiles()
      .filter((file) =>
        readFileSync(file, "utf8").includes("components/lf-select")
      )
      .map((file) => file.slice(appRoot.length + 1));

    expect(existsSync(resolve(appRoot, "src/components/lf-select.tsx"))).toBe(
      false
    );
    expect(importOffenders).toEqual([]);

    for (const path of formerLfSelectCallers) {
      const fileSource = source(path);

      expect(fileSource).toContain('from "@repo/ui-v2/components/ui/select"');
      expect(fileSource).not.toContain("LfSelect");
      expect(fileSource).not.toContain("<SelectTrigger className=");
      expect(fileSource).not.toMatch(/<SelectTrigger\b[^>]*\bsize="sm"/);
    }
  });

  it("ports Signals without Next.js search or link assumptions", () => {
    const routeSource = source("src/routes/_authenticated/$slug/signals.tsx");
    const clientSource = source("src/signals/signals-client.tsx");
    const createDialogSource = source("src/signals/signal-create-dialog.tsx");
    const detailSheetSource = source("src/signals/signal-detail-sheet.tsx");
    const searchSource = source("src/signals/signals-search-params.ts");
    const workspaceDataSource = source(
      "src/signals/use-signals-workspace-data.ts"
    );
    const viewsSource = source("src/signals/signals-view-switcher.tsx");
    const viewQuerySource = viewsSource;
    const viewSwitcherSource = source("src/components/views/view-switcher.tsx");

    expect(routeSource).toContain("validateSignalsSearch");
    expect(routeSource).toContain("createFileRoute");
    expect(routeSource).toContain("setSearchParams");
    expect(routeSource).not.toContain("workspaceTopbarAction");
    expect(clientSource).toContain("SignalCreateDialog");
    expect(clientSource).toContain("<SignalsViewHeader");
    expect(clientSource).toContain("SignalsViewSwitcher");
    expect(clientSource).not.toContain("viewsSlot=");
    expect(clientSource).toContain('@api/app/tanstack/signals"');
    expect(clientSource).toContain("getSignal");
    expect(clientSource).toContain('"signals", "detail"');
    expect(clientSource).not.toContain("signalQueryKeys");
    expect(clientSource).not.toContain("signals-cache");
    expect(clientSource).not.toContain("signalDetailQueryOptions");
    expect(createDialogSource).toContain('@api/app/tanstack/signals"');
    expect(createDialogSource).toContain("createSignal");
    expect(createDialogSource).toContain('queryKey: ["signals"] as const');
    expect(createDialogSource).not.toContain("signalQueryKeys");
    expect(createDialogSource).not.toContain("signals-cache");
    expect(createDialogSource).not.toContain("createSignalMutationOptions");
    expect(createDialogSource).toContain("listUserOrganizations");
    expect(createDialogSource).toContain("organizationQueryKeys.list()");
    expect(detailSheetSource).toContain('@api/app/tanstack/signals"');
    expect(detailSheetSource).toContain("getSignal");
    expect(detailSheetSource).toContain('"signals", "detail"');
    expect(detailSheetSource).not.toContain("signalQueryKeys");
    expect(detailSheetSource).not.toContain("signals-cache");
    expect(detailSheetSource).not.toContain("signalDetailQueryOptions");
    expect(searchSource).toContain("validateSignalsSearch");
    expect(searchSource).toContain("parseSignalDispositions");
    expect(workspaceDataSource).toContain("listWorkingSetSignals");
    expect(workspaceDataSource).toContain("listProcessingSignals");
    expect(workspaceDataSource).toContain(
      'const workingSetQueryKey = ["signals", "working-set"] as const'
    );
    expect(workspaceDataSource).toContain("const processingQueryKey = [");
    expect(workspaceDataSource).not.toContain("signalQueryKeys");
    expect(workspaceDataSource).not.toContain("signals-cache");
    expect(workspaceDataSource).not.toContain("workingSetSignalsQueryOptions");
    expect(workspaceDataSource).not.toContain("processingSignalsQueryOptions");
    expect(workspaceDataSource).toContain("filterClassifiedSignals");
    expect(workspaceDataSource).toContain("compareSignalsByRecency");
    expect(workspaceDataSource).not.toContain("useWorkingSetQuery");
    expect(workspaceDataSource).not.toContain("useProcessingSignalsQuery");
    expect(workspaceDataSource).not.toContain("useSignalsFiltering");
    expect(viewQuerySource).toContain('@api/app/tanstack/signal-views"');
    expect(viewQuerySource).toContain("listSignalViews");
    expect(viewQuerySource).toContain('enabled: typeof window !== "undefined"');
    expect(viewsSource).toContain("viewConfigToParamValues");
    expect(viewSwitcherSource).toContain("partitionViews");

    for (const routeFile of [
      routeSource,
      clientSource,
      createDialogSource,
      searchSource,
      viewsSource,
    ]) {
      expect(routeFile).not.toContain("next/");
      expect(routeFile).not.toContain("nuqs");
      expect(routeFile).not.toContain("workspace-command-menu");
      expect(routeFile).not.toContain("@vercel/microfrontends/next");
    }
  });

  it("ports People without Next.js search or link assumptions", () => {
    const routeSource = source("src/routes/_authenticated/$slug/people.tsx");
    const clientSource = source("src/people/people-client.tsx");
    const searchSource = source("src/people/people-search-params.ts");
    const querySource = clientSource;
    const viewsSource = source("src/people/people-view-switcher.tsx");
    const viewQuerySource = viewsSource;
    const toolbarSource = source("src/people/people-toolbar.tsx");
    const tableSource = source("src/people/people-table-view.tsx");
    const detailSource = source("src/people/people-detail-content.tsx");
    const emptySource = source("src/people/people-empty-state.tsx");

    expect(routeSource).toContain("validatePeopleSearch");
    expect(routeSource).toContain("createFileRoute");
    expect(routeSource).toContain("setSearchParams");
    expect(routeSource).not.toContain("workspaceTopbarAction");
    expect(clientSource).toContain("PeopleToolbar");
    expect(clientSource).toContain("<PeopleViewHeader");
    expect(clientSource).toContain("PeopleViewSwitcher");
    expect(clientSource).not.toContain("viewsSlot=");
    expect(clientSource).toContain("PeopleTableView");
    expect(clientSource).toContain("PeopleDetailSheet");
    expect(clientSource).not.toContain("usePeopleListQuery");
    expect(searchSource).toContain("validatePeopleSearch");
    expect(searchSource).toContain("parsePersonProviders");
    expect(querySource).toContain("listPeople");
    expect(querySource).toContain('["people", "list", listInput] as const');
    expect(querySource).not.toContain("peopleListInfiniteQueryOptions");
    expect(querySource).toContain('enabled: typeof window !== "undefined"');
    expect(viewsSource).toContain("viewConfigToParamValues");
    expect(viewQuerySource).toContain('@api/app/tanstack/people-views"');
    expect(viewQuerySource).toContain("listPeopleViews");
    expect(toolbarSource).not.toContain("viewsSlot");
    expect(tableSource).toContain("PeopleEmptyState");
    expect(detailSource).toContain('to="/$slug/signals"');
    expect(emptySource).toContain('href="/docs/get-started/overview"');

    for (const routeFile of [
      routeSource,
      clientSource,
      searchSource,
      viewsSource,
      toolbarSource,
      tableSource,
      detailSource,
      emptySource,
    ]) {
      expect(routeFile).not.toContain("next/");
      expect(routeFile).not.toContain("nuqs");
      expect(routeFile).not.toContain("@vercel/microfrontends/next");
    }
  });

  it("ports secondary workspace product routes without Next.js assumptions", () => {
    const decisionsRouteSource = source(
      "src/routes/_authenticated/$slug/decisions.tsx"
    );
    const decisionsClientSource = source("src/decisions/decisions-client.tsx");
    const decisionsDetailSource = source("src/decisions/decisions-detail.tsx");
    const decisionsSearchSource = source(
      "src/decisions/decisions-search-params.ts"
    );
    const decisionsQuerySource = decisionsClientSource;
    const skillsRouteSource = source(
      "src/routes/_authenticated/$slug/skills.tsx"
    );
    const skillsClientSource = source("src/skills/skills-client.tsx");
    const skillsSearchSource = source("src/skills/skills-search-params.ts");
    const connectorsRouteSource = source(
      "src/routes/_authenticated/$slug/connectors.tsx"
    );
    const connectorsClientSource = source(
      "src/connectors/connectors-client.tsx"
    );
    const connectorsSearchSource = source(
      "src/connectors/connectors-search-params.ts"
    );
    const automationsRouteSource = source(
      "src/routes/_authenticated/$slug/automations.tsx"
    );
    const automationsIndexRouteSource = source(
      "src/routes/_authenticated/$slug/automations/index.tsx"
    );
    const automationsNewRouteSource = source(
      "src/routes/_authenticated/$slug/automations/new.tsx"
    );
    const automationDetailRouteSource = source(
      "src/routes/_authenticated/$slug/automations/$automation.tsx"
    );
    const automationsClientSource = source(
      "src/automations/automations-client.tsx"
    );
    const automationsCreateSource = source(
      "src/automations/automation-create-form.tsx"
    );
    const automationsPromptSource = source(
      "src/automations/automation-prompt-editor.tsx"
    );
    const automationsDetailSource = source(
      "src/automations/automation-detail-client.tsx"
    );
    const automationsQuerySource = automationsClientSource;

    expect(decisionsRouteSource).toContain("validateDecisionsSearch");
    expect(decisionsRouteSource).toContain("setSearchParams");
    expect(decisionsClientSource).toContain("<DecisionsViewHeader");
    expect(decisionsClientSource).toContain("DecisionsToolbar");
    expect(decisionsClientSource).toContain("DecisionsTableView");
    expect(decisionsSearchSource).toContain("parseDecisionProviders");
    expect(decisionsQuerySource).toContain('@api/app/tanstack/decisions"');
    expect(decisionsQuerySource).toContain("listDecisions");
    expect(decisionsQuerySource).toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(decisionsQuerySource).not.toContain(
      "decisionsListInfiniteQueryOptions"
    );
    expect(decisionsQuerySource).not.toContain("./decisions-queries");
    expect(decisionsClientSource).not.toContain("useDecisionsListQuery");

    expect(skillsRouteSource).toContain("validateSkillsSearch");
    expect(skillsRouteSource).toContain("setSearchParams");
    expect(skillsClientSource).toContain("SkillGrid");
    expect(skillsClientSource).toContain("SkillDialog");
    expect(skillsSearchSource).toContain("validateSkillsSearch");
    expect(skillsClientSource).toContain('@api/app/tanstack/skills"');
    expect(skillsClientSource).toContain("listSkills");
    expect(skillsClientSource).toContain(
      'queryKey: ["skills", "list"] as const'
    );
    expect(skillsClientSource).not.toContain("skillsListQueryKey");
    expect(skillsClientSource).not.toContain("skills-queries");
    expect(skillsClientSource).toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(existsSync(resolve(appRoot, "src/skills/skills-queries.ts"))).toBe(
      false
    );
    expect(skillsClientSource).not.toContain("useSkillsListQuery");

    expect(connectorsRouteSource).toContain("validateConnectorsSearch");
    expect(connectorsRouteSource).toContain("setSearchParams");
    expect(connectorsClientSource).toContain('@api/app/tanstack/connectors"');
    expect(connectorsClientSource).toContain("listConnectorSections");
    expect(connectorsClientSource).toContain(
      'queryKey: ["connectors", "sections"] as const'
    );
    expect(connectorsClientSource).toContain(
      'queryKey: ["connectors"] as const'
    );
    expect(connectorsClientSource).not.toContain("connectorQueryKeys");
    expect(connectorsClientSource).not.toContain("connectors-cache");
    expect(connectorsClientSource).not.toContain(
      "connectorSectionsQueryOptions"
    );
    expect(connectorsClientSource).toContain(
      '@api/app/tanstack/user-connectors"'
    );
    expect(connectorsClientSource).toContain("startConnector");
    expect(connectorsClientSource).toContain("startUserConnector");
    expect(connectorsClientSource).toContain("disconnectUserConnector");
    expect(connectorsClientSource).not.toContain(
      "startConnectorMutationOptions"
    );
    expect(connectorsClientSource).not.toContain(
      "startUserConnectorMutationOptions"
    );
    expect(connectorsClientSource).not.toContain(
      "disconnectUserConnectorMutationOptions"
    );
    expect(connectorsClientSource).toContain("window.location.assign");
    expect(connectorsClientSource).toContain("ConnectorDetailSheet");
    expect(connectorsClientSource).toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(connectorsSearchSource).toContain("validateConnectorsSearch");

    expect(automationsRouteSource).toContain("component: Outlet");
    expect(automationsIndexRouteSource).toContain("AutomationsClient");
    expect(automationsNewRouteSource).toContain("AutomationCreateForm");
    expect(automationDetailRouteSource).toContain("AutomationDetailClient");
    expect(automationDetailRouteSource).toContain(
      "validateAutomationDetailSearch"
    );
    expect(automationsClientSource).toContain(
      'to="/$slug/automations/$automation"'
    );
    expect(automationsCreateSource).toContain(
      "automationCreateMutationOptions"
    );
    expect(automationsDetailSource).toContain('@api/app/tanstack/automations"');
    expect(automationsDetailSource).toContain("getAutomation");
    expect(automationsDetailSource).toContain("automationQueryKeys.detail");
    expect(automationsDetailSource).not.toContain(
      "automationDetailQueryOptions"
    );
    expect(automationsQuerySource).toContain('@api/app/tanstack/automations"');
    expect(automationsQuerySource).toContain("listAutomations");
    expect(automationsQuerySource).toContain("automationQueryKeys.list()");
    expect(automationsQuerySource).not.toContain("automationsListQueryOptions");
    expect(automationsQuerySource).toContain(
      'enabled: typeof window !== "undefined"'
    );

    for (const routeFile of [
      decisionsRouteSource,
      decisionsClientSource,
      decisionsDetailSource,
      decisionsSearchSource,
      skillsRouteSource,
      skillsClientSource,
      skillsSearchSource,
      connectorsRouteSource,
      connectorsClientSource,
      connectorsSearchSource,
      automationsRouteSource,
      automationsIndexRouteSource,
      automationsNewRouteSource,
      automationDetailRouteSource,
      automationsClientSource,
      automationsCreateSource,
      automationsPromptSource,
      automationsDetailSource,
    ]) {
      expect(routeFile).not.toContain("next/");
      expect(routeFile).not.toContain("nuqs");
      expect(routeFile).not.toContain("@vercel/microfrontends/next");
      expect(routeFile).not.toContain(
        'from "@repo/ui/components/ai-elements/code-block"'
      );
      expect(routeFile).not.toContain('from "@repo/ui/components/markdown"');
      expect(routeFile).not.toContain('"use client"');
      expect(routeFile).not.toContain('"use server"');
    }
  });

  it("ports workspace assistant chat routes without Next.js assumptions", () => {
    const packageSource = source("package.json");
    const chatRouteSource = source("src/routes/_authenticated/$slug/chat.tsx");
    const chatIndexRouteSource = source(
      "src/routes/_authenticated/$slug/chat/index.tsx"
    );
    const conversationRouteSource = source(
      "src/routes/_authenticated/$slug/chat/$conversationId.tsx"
    );
    const assistantClientSource = source(
      "src/chat/workspace-assistant-client.tsx"
    );
    const composerSource = source("src/chat/chat-composer.tsx");
    const messageSource = source("src/chat/chat-message.tsx");
    const messagePartSource = source("src/chat/message-part.tsx");
    const copyButtonSource = source("src/chat/message-copy-button.tsx");
    const chatRequestRouteSource = repoSource(
      "api/app/src/adapters/internal/workspace-assistant/chat-route.ts"
    );
    const chatStreamRouteSource = repoSource(
      "api/app/src/adapters/internal/workspace-assistant/stream-route.ts"
    );
    const conversationIdSource = source("src/chat/conversation-id.ts");
    const resumableConfigPath = resolve(
      appRoot,
      "src/chat/resumable-stream-config.ts"
    );

    expect(packageSource).toContain('"@ai-sdk/react": "catalog:"');
    expect(packageSource).toContain('"@vendor/ai": "workspace:*"');
    expect(chatRouteSource).toContain("component: Outlet");
    expect(chatIndexRouteSource).toContain(
      'createFileRoute("/_authenticated/$slug/chat/")'
    );
    expect(chatIndexRouteSource).toContain(
      "createWorkspaceAssistantConversationId"
    );
    expect(chatIndexRouteSource).toContain('from "~/chat/conversation-id"');
    expect(chatIndexRouteSource).not.toContain('@api/app/tanstack/assistant"');
    expect(chatIndexRouteSource).not.toContain("@db/app");
    expect(conversationIdSource).toContain(
      'WORKSPACE_ASSISTANT_CONVERSATION_ID_PREFIX = "conv_"'
    );
    expect(conversationIdSource).toContain("crypto.randomUUID()");
    expect(chatIndexRouteSource).toContain("WorkspaceAssistantClient");
    expect(chatIndexRouteSource).toContain("key={conversationId}");
    expect(chatRouteSource).not.toContain("WorkspacePage");
    expect(conversationRouteSource).toContain("getConversation");
    expect(conversationRouteSource).toContain("useQuery");
    expect(conversationRouteSource).toContain(
      '["workspace-assistant", "conversation", conversationId] as const'
    );
    expect(conversationRouteSource).not.toContain("loader:");
    expect(conversationRouteSource).not.toContain("Route.useLoaderData()");
    expect(conversationRouteSource).not.toContain(
      "assistantConversationQueryKey"
    );
    expect(conversationRouteSource).not.toContain(
      "assistantConversationQueryOptions"
    );
    expect(conversationRouteSource).toContain("WorkspaceAssistantClient");
    expect(conversationRouteSource).toContain("isPreallocatedConversationId");
    expect(conversationRouteSource).not.toContain("~/chat/conversation-id");
    expect(conversationRouteSource).toContain("notFound()");
    expect(assistantClientSource).toContain("useChat");
    expect(assistantClientSource).toContain("DefaultChatTransport");
    expect(assistantClientSource).toContain("useParams({ strict: false })");
    expect(assistantClientSource).toContain("useRouter");
    expect(assistantClientSource).toContain("History.prototype.replaceState");
    expect(assistantClientSource).toContain("workspaceConversationPath");
    expect(assistantClientSource).toContain(
      'to: "/$slug/chat/$conversationId"'
    );
    expect(assistantClientSource).toContain("createConversation({ data })");
    expect(assistantClientSource).toContain(
      '["workspace-assistant", "conversations"] as const'
    );
    expect(assistantClientSource).toContain(
      '"workspace-assistant",\n            "conversation",\n            conversationId'
    );
    expect(assistantClientSource).not.toContain(
      "assistantConversationQueryKey"
    );
    expect(assistantClientSource).not.toContain("setQueryData");
    expect(assistantClientSource).not.toContain(
      "assistantConversationQueryOptions"
    );
    expect(composerSource).toContain("PromptInput");
    expect(composerSource).toContain("PromptInputSubmit");
    expect(messageSource).toContain("ChatMessage");
    expect(messagePartSource).toContain("WorkspaceAssistantMessagePart");
    expect(copyButtonSource).toContain("extractMessageText");
    expect(conversationIdSource).toContain(
      "createWorkspaceAssistantConversationId"
    );
    expect(existsSync(resumableConfigPath)).toBe(false);
    expect(assistantClientSource).toContain("isResumableStreamEnabled");
    expect(assistantClientSource).toContain("VITE_VERCEL_ENV");
    expect(assistantClientSource).not.toContain("resumable-stream-config");
    expect(chatRequestRouteSource).toContain("isResumableStreamEnabled");
    expect(chatRequestRouteSource).toContain("VITE_VERCEL_ENV");
    expect(chatRequestRouteSource).not.toContain("resumable-stream-config");
    expect(chatStreamRouteSource).toContain("isResumableStreamEnabled");
    expect(chatStreamRouteSource).toContain("VITE_VERCEL_ENV");
    expect(chatStreamRouteSource).not.toContain("resumable-stream-config");
    expect(assistantClientSource).toContain(
      "@repo/ui-v2/components/ai-elements/conversation"
    );
    expect(composerSource).toContain(
      "@repo/ui-v2/components/ai-elements/prompt-input"
    );
    expect(messageSource).toContain(
      "@repo/ui-v2/components/ai-elements/message"
    );
    expect(messagePartSource).toContain(
      "@repo/ui-v2/components/ai-elements/message"
    );
    expect(messagePartSource).toContain(
      "@repo/ui-v2/components/ai-elements/thinking-steps"
    );
    expect(messagePartSource).toContain(
      "@repo/ui-v2/components/ai-elements/tool"
    );

    for (const routeFile of [
      chatRouteSource,
      chatIndexRouteSource,
      conversationRouteSource,
      assistantClientSource,
      composerSource,
      messageSource,
      messagePartSource,
      copyButtonSource,
      chatRequestRouteSource,
      chatStreamRouteSource,
    ]) {
      expect(routeFile).not.toContain("next/");
      expect(routeFile).not.toContain("nuqs");
      expect(routeFile).not.toContain("@repo/ui/components/ai-elements");
      expect(routeFile).not.toContain('"use client"');
      expect(routeFile).not.toContain('"use server"');
    }
  });

  it("ports org setup routes and GitHub callbacks", () => {
    const orgRouteSource = source("src/routes/_authenticated/$slug.tsx");
    const workspaceShellSource = source(
      "src/workspace/workspace-route-shell.tsx"
    );
    const workspaceModelSource = source(
      "src/workspace/workspace-route-model.ts"
    );
    const accountGithubRouteSource = source(
      "src/routes/_authenticated/account/tasks/github.tsx"
    );
    const accountGithubIndexRouteSource = source(
      "src/routes/_authenticated/account/tasks/github/index.tsx"
    );
    const bindRouteSource = source(
      "src/routes/_authenticated/$slug/tasks/bind.tsx"
    );
    const bindIndexRouteSource = source(
      "src/routes/_authenticated/$slug/tasks/bind/index.tsx"
    );
    const tasksRouteSource = source(
      "src/routes/_authenticated/$slug/tasks.tsx"
    );
    const tasksIndexRouteSource = source(
      "src/routes/_authenticated/$slug/tasks/index.tsx"
    );
    const lightfastRepoRouteSource = source(
      "src/routes/_authenticated/$slug/tasks/github/lightfast-repo.tsx"
    );
    const completeRouteSource = source(
      "src/routes/_authenticated/$slug/tasks/bind/github/complete.tsx"
    );
    const completeClientSource = source(
      "src/org/setup/github-bind-complete-client.tsx"
    );
    const bindCardSource = source("src/org/setup/bind-github-card.tsx");
    const repoClientSource = source(
      "src/org/setup/lightfast-repo-setup-client.tsx"
    );
    const setupCallbackSource = source("src/routes/api/github/setup.ts");
    const oauthCallbackSource = source(
      "src/routes/api/github/oauth/callback.ts"
    );

    expect(orgRouteSource).toContain("WorkspaceRouteShell");
    expect(workspaceShellSource).toContain('bindingStatus !== "bound"');
    expect(workspaceShellSource).not.toContain("AuthenticatedTopbar");
    expect(workspaceShellSource).not.toContain("useWorkspaceTopbarAction");
    expect(workspaceShellSource).not.toContain("workspaceTopbarAction");
    expect(workspaceModelSource).toContain('to: "/$slug/tasks/bind"');
    expect(workspaceModelSource).toContain(
      'to: "/$slug/tasks/github/lightfast-repo"'
    );
    expect(workspaceModelSource).toContain(
      ["pathname === `/", "$", "{slug}", "/tasks`"].join("")
    );
    expect(accountGithubRouteSource).toContain("component: Outlet");
    expect(accountGithubIndexRouteSource).toContain(
      'createFileRoute("/_authenticated/account/tasks/github/")'
    );
    expect(accountGithubIndexRouteSource).toContain("GithubAccountTaskClient");
    expect(tasksRouteSource).toContain(
      'createFileRoute("/_authenticated/$slug/tasks")'
    );
    expect(tasksRouteSource).toContain("component: Outlet");
    expect(tasksIndexRouteSource).toContain(
      'createFileRoute("/_authenticated/$slug/tasks/")'
    );
    expect(tasksIndexRouteSource).toContain("Connect GitHub organization");
    expect(tasksIndexRouteSource).toContain("Verify .lightfast repository");
    expect(tasksIndexRouteSource).toContain('href="/$slug/tasks/bind"');
    expect(tasksIndexRouteSource).toContain(
      'href="/$slug/tasks/github/lightfast-repo"'
    );
    expect(bindRouteSource).toContain("component: Outlet");
    expect(bindIndexRouteSource).toContain("githubBindErrorCodeSchema");
    expect(bindIndexRouteSource).toContain("useSearch({ strict: false })");
    expect(bindIndexRouteSource).not.toContain("useRouterState");
    expect(bindIndexRouteSource).toContain("BindGithubCard");
    expect(bindCardSource).toContain('@api/app/tanstack/github-setup"');
    expect(bindCardSource).toContain("startGitHubOrgSetup");
    expect(bindCardSource).not.toContain("startGitHubOrgSetupMutationOptions");
    expect(lightfastRepoRouteSource).toContain("getSourceControlConnection");
    expect(lightfastRepoRouteSource).toContain(
      "sourceControlConnectionQueryKey"
    );
    expect(lightfastRepoRouteSource).toContain("newLightfastRepositoryUrl");
    expect(lightfastRepoRouteSource).not.toContain("getGitHubNewRepositoryUrl");
    expect(repoClientSource).toContain('@api/app/tanstack/github-setup"');
    expect(repoClientSource).toContain("verifyGitHubLightfastRepo");
    expect(repoClientSource).not.toContain(
      "verifyGitHubLightfastRepoMutationOptions"
    );
    expect(repoClientSource).toContain("newRepositoryUrl");
    expect(repoClientSource).not.toContain("https://github.com");
    expect(completeRouteSource).toContain("GitHubBindCompleteClient");
    expect(completeClientSource).toContain('result.bindingStatus !== "bound"');
    expect(completeClientSource).toContain("setFailed(true)");
    expect(setupCallbackSource).toContain(
      "handleGitHubInstallationSetupRequest"
    );
    expect(oauthCallbackSource).toContain("handleGitHubOAuthCallbackRequest");

    for (const routeFile of [
      bindRouteSource,
      lightfastRepoRouteSource,
      completeRouteSource,
      completeClientSource,
      bindCardSource,
      repoClientSource,
      tasksRouteSource,
      tasksIndexRouteSource,
      bindIndexRouteSource,
      accountGithubRouteSource,
      accountGithubIndexRouteSource,
    ]) {
      expect(routeFile).not.toContain("next/");
    }
  });

  it("keeps internal GitHub and connector route handlers server-only", () => {
    for (const expectation of internalApiRouteLazyImportExpectations) {
      const routeSource = source(expectation.path);

      expect(routeSource).toContain("await import(");
      expect(routeSource).toContain(`"${expectation.moduleSpecifier}"`);
      expect(routeSource).toContain(expectation.handlerName);
      expect(routeSource).not.toContain(expectation.staticImport);
      expect(routeSource).not.toContain("@db/app");
      expect(routeSource).not.toContain("next/");
      expect(routeSource).not.toContain('"use server"');
    }
  });

  it("ports org source-control settings without Next.js route imports", () => {
    const settingsLayoutSource = source(
      "src/routes/_authenticated/$slug/settings.tsx"
    );
    const sourceControlRouteSource = source(
      "src/routes/_authenticated/$slug/settings/source-control.tsx"
    );
    const sidebarSource = source("src/components/settings-sidebar.tsx");
    const settingsClientSource = source(
      "src/org/settings/source-control/source-control-settings-client.tsx"
    );
    const connectionCardSource = source(
      "src/org/settings/source-control/source-control-connection-card.tsx"
    );
    const repositoryListSource = source(
      "src/org/settings/source-control/repository-list.tsx"
    );
    const addRepositoryDialogSource = source(
      "src/org/settings/source-control/add-repository-dialog.tsx"
    );
    const sourceControlCacheSource = source(
      "src/org/settings/source-control/source-control-cache.ts"
    );
    const sourceControlQueriesPath =
      "src/org/settings/source-control/source-control-queries.ts";
    const repositoryCardSource = source(
      "src/org/settings/source-control/repository-card.tsx"
    );
    const formatSource = source(
      "src/org/settings/source-control/source-control-format.ts"
    );

    expect(settingsLayoutSource).toContain(
      'createFileRoute("/_authenticated/$slug/settings")'
    );
    expect(settingsLayoutSource).toContain(
      "component: WorkspaceSettingsLayout"
    );
    expect(settingsLayoutSource).toContain(
      'to: "/$slug/settings/source-control"'
    );
    expect(settingsLayoutSource).toContain("<Outlet />");
    expect(settingsLayoutSource).toContain("SettingsSidebar");
    expect(sourceControlRouteSource).toContain("createFileRoute");
    expect(sourceControlRouteSource).toContain(
      '"/_authenticated/$slug/settings/source-control"'
    );
    expect(sourceControlRouteSource).toContain("SourceControlSettingsClient");
    expect(sidebarSource).toContain("params");
    expect(existsSync(resolve(appRoot, sourceControlQueriesPath))).toBe(false);
    expect(settingsClientSource).toContain("getSourceControlConnection");
    expect(settingsClientSource).toContain("listSourceControlRepositories");
    expect(settingsClientSource).toContain("sourceControlConnectionQueryKey");
    expect(settingsClientSource).toContain("sourceControlRepositoriesQueryKey");
    expect(settingsClientSource).not.toContain(
      "sourceControlConnectionQueryOptions"
    );
    expect(settingsClientSource).not.toContain(
      "sourceControlRepositoriesQueryOptions"
    );
    expect(sourceControlCacheSource).toContain(
      '@api/app/tanstack/source-control"'
    );
    expect(sourceControlCacheSource).not.toContain("queryOptions");
    expect(sourceControlCacheSource).not.toContain("mutationOptions");
    expect(settingsClientSource).toContain("SourceControlConnectionCard");
    expect(settingsClientSource).toContain("RepositoryList");
    expect(settingsClientSource).toContain('to="/$slug/tasks/bind"');
    expect(connectionCardSource).toContain(
      'to="/$slug/tasks/github/lightfast-repo"'
    );
    expect(repositoryListSource).toContain("useAuth");
    expect(repositoryListSource).toContain(
      'from "@repo/ui-v2/components/ui/select"'
    );
    expect(repositoryListSource).toContain("AddRepositoryDialog");
    expect(repositoryListSource).toContain("RepositoryCard");
    expect(repositoryListSource).not.toContain("LfSelect");
    expect(addRepositoryDialogSource).toContain(
      "importSourceControlRepository"
    );
    expect(addRepositoryDialogSource).toContain("setQueryData");
    expect(addRepositoryDialogSource).not.toContain(
      "importSourceControlRepositoryMutationOptions"
    );
    expect(addRepositoryDialogSource).toContain("LIGHTFAST_REPOSITORY_NAME");
    expect(repositoryCardSource).toContain("Open on GitHub");
    expect(formatSource).toContain("formatStatusSubtitle");
    expect(existsSync(resolve(appRoot, "src/components/lf-select.tsx"))).toBe(
      false
    );

    for (const routeFile of [
      settingsLayoutSource,
      sourceControlRouteSource,
      settingsClientSource,
      connectionCardSource,
      repositoryListSource,
      addRepositoryDialogSource,
      sourceControlCacheSource,
      repositoryCardSource,
      formatSource,
    ]) {
      expect(routeFile).not.toContain("next/");
      expect(routeFile).not.toContain("@vendor/clerk");
    }
  });

  it("ports org admin settings routes without Next.js assumptions", () => {
    const settingsLayoutSource = source(
      "src/routes/_authenticated/$slug/settings.tsx"
    );
    const membersRouteSource = source(
      "src/routes/_authenticated/$slug/settings/members.tsx"
    );
    const apiKeysRouteSource = source(
      "src/routes/_authenticated/$slug/settings/api-keys.tsx"
    );
    const mcpRouteSource = source(
      "src/routes/_authenticated/$slug/settings/mcp.tsx"
    );
    const sidebarSource = source("src/components/settings-sidebar.tsx");
    const membersClientSource = source(
      "src/org/settings/members/org-members-client.tsx"
    );
    const memberListSource = source(
      "src/org/settings/members/org-member-list.tsx"
    );
    const memberInviteSource = source(
      "src/org/settings/members/org-member-invite.tsx"
    );
    const memberInviteActionsPath =
      "src/org/settings/members/org-member-invite-actions.ts";
    const memberListActionsPath =
      "src/org/settings/members/org-member-list-actions.ts";
    const memberCacheSource = source(
      "src/org/settings/members/org-member-cache.ts"
    );
    const memberQueriesPath = "src/org/settings/members/org-member-queries.ts";
    const apiKeyCreateSource = source(
      "src/org/settings/api-keys/org-api-key-create.tsx"
    );
    const apiKeyCreateActionsPath =
      "src/org/settings/api-keys/org-api-key-create-action.ts";
    const apiKeyListSource = source(
      "src/org/settings/api-keys/org-api-key-list.tsx"
    );
    const apiKeyListActionsPath =
      "src/org/settings/api-keys/org-api-key-list-actions.ts";
    const apiKeyCacheSource = source(
      "src/org/settings/api-keys/org-api-key-cache.ts"
    );
    const apiKeyQueriesPath =
      "src/org/settings/api-keys/org-api-key-queries.ts";
    const mcpQueriesPath = "src/org/settings/mcp/mcp-connections-queries.ts";
    const mcpClientSource = source(
      "src/org/settings/mcp/mcp-connections-client.tsx"
    );

    expect(settingsLayoutSource).toContain('to: "/$slug/settings/members"');
    expect(settingsLayoutSource).toContain('to: "/$slug/settings/api-keys"');
    expect(settingsLayoutSource).toContain('to: "/$slug/settings/mcp"');
    expect(settingsLayoutSource).toContain(
      'to: "/$slug/settings/source-control"'
    );
    expect(sidebarSource).toContain('"/$slug/settings/members"');
    expect(sidebarSource).toContain('"/$slug/settings/api-keys"');
    expect(sidebarSource).toContain('"/$slug/settings/mcp"');

    expect(membersRouteSource).toContain(
      '"/_authenticated/$slug/settings/members"'
    );
    expect(membersRouteSource).toContain("OrgMembersClient");
    expect(apiKeysRouteSource).toContain(
      '"/_authenticated/$slug/settings/api-keys"'
    );
    expect(apiKeysRouteSource).toContain("OrgApiKeyCreate");
    expect(apiKeysRouteSource).toContain("OrgApiKeyList");
    expect(mcpRouteSource).toContain('"/_authenticated/$slug/settings/mcp"');
    expect(mcpRouteSource).toContain("McpConnectionsClient");

    expect(membersClientSource).toContain("OrgMemberInvite");
    expect(membersClientSource).toContain("OrgMemberList");
    expect(existsSync(resolve(appRoot, memberQueriesPath))).toBe(false);
    expect(memberListSource).toContain("listOrgMembers");
    expect(memberListSource).toContain("queryKey: listQueryKey");
    expect(memberListSource).not.toContain("orgMembersQueryOptions");
    expect(memberListSource).not.toContain("orgMembers.list.queryOptions");
    expect(memberListSource).not.toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(memberListSource).toContain('from "@clerk/tanstack-react-start"');
    expect(existsSync(resolve(appRoot, memberInviteActionsPath))).toBe(false);
    expect(memberInviteSource).toContain('@api/app/tanstack/org-members"');
    expect(memberInviteSource).toContain("inviteOrgMember");
    expect(memberInviteSource).not.toContain("inviteOrgMemberMutationOptions");
    expect(memberInviteSource).not.toContain("useOrgMemberInviteAction");
    expect(existsSync(resolve(appRoot, memberListActionsPath))).toBe(false);
    expect(memberListSource).toContain('@api/app/tanstack/org-members"');
    expect(memberListSource).toContain("updateOrgMemberRole");
    expect(memberListSource).toContain("revokeOrgInvitation");
    expect(memberListSource).toContain("removeOrgMember");
    expect(memberListSource).not.toContain(
      "updateOrgMemberRoleMutationOptions"
    );
    expect(memberListSource).not.toContain(
      "revokeOrgInvitationMutationOptions"
    );
    expect(memberListSource).not.toContain("removeOrgMemberMutationOptions");
    expect(memberListSource).not.toContain("useOrgMemberListActions");
    expect(memberCacheSource).toContain("orgMemberListQueryKey");
    expect(memberCacheSource).toContain(
      'import type { ListOrgMembersResult } from "@api/app/tanstack/org-members"'
    );
    expect(memberCacheSource).not.toContain("queryOptions");
    expect(memberCacheSource).not.toContain("useTRPC");
    expect(memberCacheSource).not.toContain("AppRouterOutputs");

    expect(existsSync(resolve(appRoot, apiKeyQueriesPath))).toBe(false);
    expect(apiKeyListSource).toContain("listOrgApiKeys");
    expect(apiKeyListSource).toContain("orgApiKeyListQueryKey");
    expect(apiKeyListSource).not.toContain("orgApiKeysQueryOptions");
    expect(apiKeyListSource).not.toContain("orgApiKeyQueryKeys");
    expect(apiKeyListSource).not.toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(apiKeyListSource).toContain('from "@clerk/tanstack-react-start"');
    expect(existsSync(resolve(appRoot, apiKeyCreateActionsPath))).toBe(false);
    expect(apiKeyCreateSource).toContain('@api/app/tanstack/org-api-keys"');
    expect(apiKeyCreateSource).toContain("createOrgApiKey");
    expect(apiKeyCreateSource).not.toContain("createOrgApiKeyMutationOptions");
    expect(apiKeyCreateSource).not.toContain("useOrgApiKeyCreateAction");
    expect(existsSync(resolve(appRoot, apiKeyListActionsPath))).toBe(false);
    expect(apiKeyListSource).toContain('@api/app/tanstack/org-api-keys"');
    expect(apiKeyListSource).toContain("revokeOrgApiKey");
    expect(apiKeyListSource).toContain("deleteOrgApiKey");
    expect(apiKeyListSource).toContain("rotateOrgApiKey");
    expect(apiKeyListSource).not.toContain("revokeOrgApiKeyMutationOptions");
    expect(apiKeyListSource).not.toContain("deleteOrgApiKeyMutationOptions");
    expect(apiKeyListSource).not.toContain("rotateOrgApiKeyMutationOptions");
    expect(apiKeyListSource).not.toContain("useOrgApiKeyListActions");
    expect(apiKeyCacheSource).toContain("OrgApiKeyListData");
    expect(apiKeyCacheSource).toContain(
      'import type { ListOrgApiKeysResult } from "@api/app/tanstack/org-api-keys"'
    );

    for (const apiKeySource of [
      apiKeyCreateSource,
      apiKeyListSource,
      apiKeyCacheSource,
    ]) {
      expect(apiKeySource).not.toContain("useTRPC");
      expect(apiKeySource).not.toContain("orgApiKeys.");
      expect(apiKeySource).not.toContain("AppRouterOutputs");
    }

    expect(existsSync(resolve(appRoot, mcpQueriesPath))).toBe(false);
    expect(mcpClientSource).toContain('@api/app/tanstack/mcp-connections"');
    expect(mcpClientSource).toContain("listOrgMcpConnections");
    expect(mcpClientSource).toContain("revokeOrgMcpConnection");
    expect(mcpClientSource).not.toContain("mcp-connections-queries");
    expect(mcpClientSource).not.toContain("useTRPC");
    expect(mcpClientSource).not.toContain("org.settings.mcpConnections");
    expect(mcpClientSource).toContain("showConnectedUser");

    for (const routeFile of [
      settingsLayoutSource,
      membersRouteSource,
      apiKeysRouteSource,
      mcpRouteSource,
      sidebarSource,
      membersClientSource,
      memberListSource,
      memberInviteSource,
      memberCacheSource,
      apiKeyCreateSource,
      apiKeyListSource,
      apiKeyCacheSource,
      mcpClientSource,
    ]) {
      expect(routeFile).not.toContain("next/");
      expect(routeFile).not.toContain("@vendor/clerk");
      expect(routeFile).not.toContain('"use client"');
      expect(routeFile).not.toContain('"use server"');
    }
  });

  it("ports org general and billing settings routes without Next.js route imports", () => {
    const packageSource = source("package.json");
    const settingsLayoutSource = source(
      "src/routes/_authenticated/$slug/settings.tsx"
    );
    const generalRouteSource = source(
      "src/routes/_authenticated/$slug/settings/general.tsx"
    );
    const billingRouteSource = source(
      "src/routes/_authenticated/$slug/settings/billing.tsx"
    );
    const sidebarSource = source("src/components/settings-sidebar.tsx");
    const teamGeneralClientSource = source(
      "src/org/settings/general/team-general-settings-client.tsx"
    );
    const teamGeneralModelSource = source(
      "src/org/settings/general/team-general-settings-model.ts"
    );
    const teamGeneralActionsPath =
      "src/org/settings/general/team-general-settings-actions.ts";
    const identityCardSource = source(
      "src/org/settings/general/identity-soul-card.tsx"
    );
    const identitySectionSource = source(
      "src/org/settings/general/identity-soul-section.tsx"
    );
    const billingClientSource = source(
      "src/org/settings/billing/billing-settings-client.tsx"
    );
    const billingActionsPath =
      "src/org/settings/billing/billing-overview-actions.ts";
    const billingCancellationPath =
      "src/org/settings/billing/billing-cancellation-mutation.ts";
    const billingViewModelSource = source(
      "src/org/settings/billing/billing-view-model.ts"
    );
    const billingSectionsSource = source(
      "src/org/settings/billing/billing-sections.tsx"
    );
    const paymentDialogSource = source(
      "src/org/settings/billing/payment-method-dialog.tsx"
    );
    const newPaymentMethodSource = source(
      "src/org/settings/billing/new-payment-method-form.tsx"
    );
    const checkoutDialogSource = source(
      "src/org/settings/billing/billing-checkout-dialog.tsx"
    );
    const newCheckoutSource = source(
      "src/org/settings/billing/new-payment-checkout.tsx"
    );
    const savedCheckoutSource = source(
      "src/org/settings/billing/saved-payment-checkout.tsx"
    );

    expect(packageSource).toContain('"@repo/app-billing": "workspace:*"');
    expect(settingsLayoutSource).toContain('to: "/$slug/settings/general"');
    expect(settingsLayoutSource).toContain('to: "/$slug/settings/billing"');
    expect(settingsLayoutSource).toContain('to: "/$slug/settings/general"');
    expect(sidebarSource).toContain('"/$slug/settings/general"');
    expect(sidebarSource).toContain('"/$slug/settings/billing"');

    expect(generalRouteSource).toContain(
      '"/_authenticated/$slug/settings/general"'
    );
    expect(generalRouteSource).toContain("TeamGeneralSettingsClient");
    expect(generalRouteSource).toContain("IdentitySoulCard");
    expect(billingRouteSource).toContain(
      '"/_authenticated/$slug/settings/billing"'
    );
    expect(billingRouteSource).toContain("BillingSettingsClient");

    expect(teamGeneralClientSource).toContain("listUserOrganizations");
    expect(teamGeneralClientSource).toContain("listOrganizationDomains");
    expect(teamGeneralClientSource).toContain("useNavigate");
    expect(existsSync(resolve(appRoot, teamGeneralActionsPath))).toBe(false);
    expect(teamGeneralClientSource).toContain(
      '@api/app/tanstack/organizations"'
    );
    expect(teamGeneralClientSource).toContain("updateOrganizationName");
    expect(teamGeneralClientSource).toContain("updateOrganizationDomains");
    expect(teamGeneralClientSource).not.toContain(
      "updateOrganizationNameMutationOptions"
    );
    expect(teamGeneralClientSource).not.toContain(
      "updateOrganizationDomainsMutationOptions"
    );
    expect(teamGeneralClientSource).toContain(
      "organizationQueryKeys.domains(slug)"
    );
    expect(teamGeneralClientSource).not.toContain("useTeamNameUpdate");
    expect(teamGeneralClientSource).not.toContain("useTeamDomainsUpdate");
    expect(teamGeneralModelSource).toContain("normalizeTeamDomainList");
    expect(teamGeneralModelSource).toContain("renameOrganizationSlug");
    expect(identityCardSource).toContain('@api/app/tanstack/org-identity"');
    expect(identityCardSource).toContain("orgIdentityQueryKey");
    expect(identityCardSource).toContain("getOrgIdentity");
    expect(identityCardSource).not.toContain("orgIdentityQueryOptions");
    expect(identityCardSource).not.toContain("identity-soul-queries");
    expect(identityCardSource).not.toContain("identity.get.queryOptions");
    expect(identityCardSource).not.toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(identitySectionSource).toContain(
      'to="/$slug/settings/source-control"'
    );

    expect(billingClientSource).toContain("getOrgBillingOverview");
    expect(billingClientSource).toContain("orgBillingOverviewQueryKey");
    expect(billingClientSource).not.toContain("billingOverviewQueryOptions");
    expect(
      existsSync(
        resolve(appRoot, "src/org/settings/billing/billing-queries.ts")
      )
    ).toBe(false);
    expect(billingClientSource).not.toContain("useTRPC");
    expect(billingClientSource).not.toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(billingClientSource).toContain("usePaymentMethods");
    expect(billingClientSource).toContain("useStatements");
    expect(billingClientSource).toContain("BillingCheckoutDialog");
    expect(existsSync(resolve(appRoot, billingActionsPath))).toBe(false);
    expect(billingClientSource).toContain("orgBillingOverviewQueryKey");
    expect(billingClientSource).not.toContain("orgBillingQueryKeys");
    expect(billingClientSource).not.toContain("useBillingOverviewRefresh");
    expect(existsSync(resolve(appRoot, billingCancellationPath))).toBe(false);
    expect(billingClientSource).toContain('@api/app/tanstack/org-billing"');
    expect(billingClientSource).toContain("cancelOrgBillingSubscriptionItem");
    expect(billingClientSource).not.toContain(
      "cancelOrgBillingSubscriptionItemMutationOptions"
    );
    expect(billingClientSource).not.toContain(
      "useCancelSubscriptionItemMutation"
    );
    expect(billingViewModelSource).toContain("deriveBillingViewModel");
    expect(billingSectionsSource).toContain("PlanSection");
    expect(paymentDialogSource).toContain("NewPaymentMethodForm");
    expect(newPaymentMethodSource).toContain("PaymentElementProvider");
    expect(checkoutDialogSource).toContain("CheckoutProvider");
    expect(newCheckoutSource).toContain("window.history.replaceState");
    expect(savedCheckoutSource).toContain("window.history.replaceState");

    for (const routeFile of [
      settingsLayoutSource,
      generalRouteSource,
      billingRouteSource,
      teamGeneralClientSource,
      teamGeneralModelSource,
      identityCardSource,
      identitySectionSource,
      billingClientSource,
      billingViewModelSource,
      billingSectionsSource,
      paymentDialogSource,
      newPaymentMethodSource,
      checkoutDialogSource,
      newCheckoutSource,
      savedCheckoutSource,
    ]) {
      expect(routeFile).not.toContain("next/");
      expect(routeFile).not.toContain('"use client"');
      expect(routeFile).not.toContain('"use server"');
    }
  });

  it("ports X connector setup and non-OAuth backend parity routes", () => {
    const xLayoutRouteSource = source(
      "src/routes/_authenticated/$slug/tasks/connectors/x.tsx"
    );
    const xSetupRouteSource = source(
      "src/routes/_authenticated/$slug/tasks/connectors/x/index.tsx"
    );
    const xCompleteRouteSource = source(
      "src/routes/_authenticated/$slug/tasks/connectors/x/complete.tsx"
    );
    const xSetupClientSource = source(
      "src/org/setup/x-connector-setup-client.tsx"
    );
    const xCompleteClientSource = source(
      "src/org/setup/x-connector-setup-complete-client.tsx"
    );
    const githubWebhookRouteSource = source("src/routes/api/github/webhook.ts");
    const skillsIndexEventsRouteSource = source(
      "src/routes/api/skills/index/events.ts"
    );
    const skillsIndexEventStreamPath = resolve(
      appRoot,
      "src/server/skills/skill-index-event-stream.ts"
    );
    const skillsEventsAdapterSource = repoSource(
      "api/app/src/adapters/internal/skills-events.ts"
    );
    const skillsEventsServiceSource = repoSource(
      "api/app/src/services/skills/events.ts"
    );
    const apiPackageJson = JSON.parse(repoSource("api/app/package.json")) as {
      exports: Record<string, { default: string; types: string }>;
    };
    const nativeProxyServerPath = resolve(
      appRoot,
      "src/server/native-proxy.ts"
    );
    const cliApiAdapterSource = repoSource("api/app/src/adapters/cli-api.ts");
    const nativeProxyCallRoutePath = resolve(
      appRoot,
      "src/routes/api/native/proxy/call.ts"
    );
    const nativeProxyRoutinesRoutePath = resolve(
      appRoot,
      "src/routes/api/native/proxy/routines.ts"
    );
    const mcpServiceAuthPath = resolve(
      appRoot,
      "src/server/mcp-service-auth.ts"
    );
    const mcpProxyServerPath = resolve(appRoot, "src/server/mcp-proxy.ts");
    const mcpServiceAuthAdapterSource = repoSource(
      "api/app/src/adapters/internal/mcp-service-auth.ts"
    );
    const mcpProxyAdapterSource = repoSource(
      "api/app/src/adapters/internal/mcp-proxy.ts"
    );
    const mcpProxyCallRouteSource = source(
      "src/routes/api/internal/mcp/proxy/call.ts"
    );
    const mcpProxyFindRouteSource = source(
      "src/routes/api/internal/mcp/proxy/find.ts"
    );
    const mcpDecisionsFindRouteSource = source(
      "src/routes/api/internal/mcp/decisions/find.ts"
    );
    const mcpDecisionsGetRouteSource = source(
      "src/routes/api/internal/mcp/decisions/get.ts"
    );
    const mcpAuditRouteSource = source("src/routes/api/internal/mcp/audit.ts");
    const mcpSignalsRouteSource = source(
      "src/routes/api/internal/mcp/signals.ts"
    );
    const mcpSignalsGetRouteSource = source(
      "src/routes/api/internal/mcp/signals/get.ts"
    );
    const mcpDecisionsAdapterSource = repoSource(
      "api/app/src/adapters/internal/mcp-decisions.ts"
    );

    expect(xLayoutRouteSource).toContain(
      '"/_authenticated/$slug/tasks/connectors/x"'
    );
    expect(xLayoutRouteSource).toContain("component: Outlet");
    expect(xSetupRouteSource).toContain(
      '"/_authenticated/$slug/tasks/connectors/x/"'
    );
    expect(xSetupRouteSource).toContain("pathForSetupRequirement");
    expect(xSetupRouteSource).toContain("XConnectorSetupClient");
    expect(xCompleteRouteSource).toContain(
      '"/_authenticated/$slug/tasks/connectors/x/complete"'
    );
    expect(xCompleteRouteSource).toContain("XConnectorSetupCompleteClient");
    expect(xSetupClientSource).toContain("listConnectors");
    expect(xSetupClientSource).toContain(
      'queryKey: ["connectors", "list"] as const'
    );
    expect(xSetupClientSource).not.toContain("connectorQueryKeys");
    expect(xSetupClientSource).not.toContain("connectors-cache");
    expect(xSetupClientSource).not.toContain("connectorsListQueryOptions");
    expect(xSetupClientSource).toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(xSetupClientSource).toContain("ConnectorIcon");
    expect(xSetupClientSource).toContain('@api/app/tanstack/connectors"');
    expect(xSetupClientSource).toContain("startConnector");
    expect(xSetupClientSource).not.toContain("startConnectorMutationOptions");
    expect(xSetupClientSource).toContain("window.location.assign");
    expect(xCompleteClientSource).toContain("useSession");
    expect(xCompleteClientSource).toContain("useNavigate");
    expect(xCompleteClientSource).toContain('@api/app/tanstack/github-setup"');
    expect(xCompleteClientSource).toContain("syncGitHubBindingClaim");
    expect(xCompleteClientSource).not.toContain(
      "syncGitHubBindingClaimMutationOptions"
    );
    expect(xCompleteClientSource).toContain("pathForSetupRequirement");

    expect(githubWebhookRouteSource).toContain(
      'createFileRoute("/api/github/webhook")'
    );
    expect(githubWebhookRouteSource).toContain("handleGitHubWebhook");
    expect(skillsIndexEventsRouteSource).toContain(
      'createFileRoute("/api/skills/index/events")'
    );
    expect(skillsIndexEventsRouteSource).toContain(
      "handleSkillIndexEventsRequest"
    );
    expect(skillsIndexEventsRouteSource).toContain("await import(");
    expect(skillsIndexEventsRouteSource).toContain(
      '"@api/app/internal-api/skills-events"'
    );
    expect(skillsIndexEventsRouteSource).not.toContain(
      'import { handleSkillIndexEventsRequest } from "@api/app/internal-api/skills-events"'
    );
    expect(skillsIndexEventsRouteSource).not.toContain(
      "@api/app/services/skills/events"
    );
    expect(skillsIndexEventsRouteSource).not.toContain("@db/app");
    expect(skillsIndexEventsRouteSource).not.toContain(
      "resolveAuthContextFromClerk"
    );
    expect(apiPackageJson.exports["./internal-api/skills-events"]).toEqual({
      default: "./src/adapters/internal/skills-events.ts",
      types: "./src/adapters/internal/skills-events.ts",
    });
    expect(apiPackageJson.exports["./services/skills/events"]).toBeUndefined();
    expect(existsSync(skillsIndexEventStreamPath)).toBe(false);
    expect(skillsEventsAdapterSource).toContain(
      "handleSkillIndexEventsRequest"
    );
    expect(skillsEventsAdapterSource).toContain("../../services/skills/events");
    expect(skillsEventsAdapterSource).toContain("resolveAuthContextFromClerk");
    expect(skillsEventsAdapterSource).toContain("@db/app/client");
    expect(skillsEventsAdapterSource).toContain("Request");
    expect(skillsEventsAdapterSource).toContain("Response");
    expect(skillsEventsServiceSource).not.toContain(
      "resolveAuthContextFromClerk"
    );
    expect(skillsEventsServiceSource).not.toContain("@db/app/client");
    expect(skillsEventsServiceSource).not.toContain("Request");
    expect(skillsEventsServiceSource).not.toContain("Response");
    expect(skillsEventsServiceSource).toContain("createSkillIndexEventStream");
    expect(skillsEventsServiceSource).toContain("redis.subscribe");
    expect(existsSync(nativeProxyServerPath)).toBe(false);
    expect(existsSync(nativeProxyCallRoutePath)).toBe(false);
    expect(existsSync(nativeProxyRoutinesRoutePath)).toBe(false);
    expect(cliApiAdapterSource).toContain("createCliProviderRoutineContext");
    expect(cliApiAdapterSource).toContain("loadAgentConnectorRuntimeTools");
    expect(cliApiAdapterSource).toContain("adapters");
    expect(cliApiAdapterSource).toContain('sourceSurface: "native_cli"');
    expect(cliApiAdapterSource).toContain('"providerRoutines.find"');
    expect(cliApiAdapterSource).toContain('"providerRoutines.call"');
    expect(cliApiAdapterSource).not.toContain(
      "handleCliProviderRoutineCallRequest"
    );
    expect(cliApiAdapterSource).not.toContain(
      "handleCliProviderRoutineFindRequest"
    );
    expect(existsSync(mcpServiceAuthPath)).toBe(false);
    expect(existsSync(mcpProxyServerPath)).toBe(false);
    expect(mcpProxyAdapterSource).toContain("handleMcpProxyFindRequest");
    expect(mcpProxyAdapterSource).toContain("handleMcpProxyCallRequest");
    expect(mcpProxyAdapterSource).toContain("loadAgentConnectorRuntimeTools");
    expect(mcpProxyAdapterSource).toContain("adapters");
    expect(mcpProxyAdapterSource).toContain('sourceSurface: "hosted_mcp"');
    expect(mcpProxyAdapterSource).toContain('from "./mcp-service-auth"');
    expect(mcpServiceAuthAdapterSource).toContain(
      "process.env.SERVICE_JWT_SECRET"
    );
    expect(mcpServiceAuthAdapterSource).toContain("verifyServiceJWT");
    expect(mcpDecisionsAdapterSource).toContain("handleMcpDecisionFindRequest");
    expect(mcpDecisionsAdapterSource).toContain("handleMcpDecisionGetRequest");
    expect(mcpDecisionsAdapterSource).toContain("findDecisions");
    expect(mcpDecisionsAdapterSource).toContain("getDecision");
    expect(mcpDecisionsAdapterSource).not.toContain(
      "loadAgentConnectorRuntimeTools"
    );
    expect(mcpDecisionsFindRouteSource).toContain(
      'createFileRoute("/api/internal/mcp/decisions/find")'
    );
    expect(mcpDecisionsFindRouteSource).toContain("await import(");
    expect(mcpDecisionsFindRouteSource).toContain(
      '"@api/app/internal-api/mcp-decisions"'
    );
    expect(mcpDecisionsGetRouteSource).toContain(
      'createFileRoute("/api/internal/mcp/decisions/get")'
    );
    expect(mcpDecisionsGetRouteSource).toContain("await import(");
    expect(mcpDecisionsGetRouteSource).toContain(
      '"@api/app/internal-api/mcp-decisions"'
    );
    expect(mcpProxyCallRouteSource).toContain(
      'createFileRoute("/api/internal/mcp/proxy/call")'
    );
    expect(mcpProxyCallRouteSource).toContain("await import(");
    expect(mcpProxyCallRouteSource).toContain(
      '"@api/app/internal-api/mcp-proxy"'
    );
    expect(mcpProxyCallRouteSource).not.toContain(
      'import { handleMcpProxyCallRequest } from "@api/app/internal-api/mcp-proxy"'
    );
    expect(mcpProxyCallRouteSource).not.toContain("~/server/mcp-proxy");
    expect(mcpProxyFindRouteSource).toContain(
      'createFileRoute("/api/internal/mcp/proxy/find")'
    );
    expect(mcpProxyFindRouteSource).toContain("await import(");
    expect(mcpProxyFindRouteSource).toContain(
      '"@api/app/internal-api/mcp-proxy"'
    );
    expect(mcpProxyFindRouteSource).not.toContain(
      'import { handleMcpProxyFindRequest } from "@api/app/internal-api/mcp-proxy"'
    );
    expect(mcpProxyFindRouteSource).not.toContain("~/server/mcp-proxy");
    expect(mcpAuditRouteSource).toContain(
      'createFileRoute("/api/internal/mcp/audit")'
    );
    expect(mcpAuditRouteSource).toContain(
      "handleRecordMcpAuditInternalRequest"
    );
    expect(mcpSignalsRouteSource).toContain(
      'createFileRoute("/api/internal/mcp/signals")'
    );
    expect(mcpSignalsRouteSource).toContain(
      "handleCreateMcpSignalInternalRequest"
    );
    expect(mcpSignalsGetRouteSource).toContain(
      'createFileRoute("/api/internal/mcp/signals/get")'
    );
    expect(mcpSignalsGetRouteSource).toContain(
      "handleGetMcpSignalInternalRequest"
    );

    for (const startupSensitiveFile of [
      mcpSignalsRouteSource,
      mcpSignalsGetRouteSource,
    ]) {
      expect(startupSensitiveFile).not.toContain('from "@api/app');
    }
    expect(mcpProxyAdapterSource).not.toContain(
      `from "${oldProviderRoutinesPackage}"`
    );

    for (const routeFile of [
      xSetupRouteSource,
      xCompleteRouteSource,
      xSetupClientSource,
      xCompleteClientSource,
      githubWebhookRouteSource,
      skillsIndexEventsRouteSource,
      skillsEventsAdapterSource,
      cliApiAdapterSource,
      mcpProxyAdapterSource,
      mcpDecisionsAdapterSource,
      mcpDecisionsFindRouteSource,
      mcpDecisionsGetRouteSource,
      mcpProxyCallRouteSource,
      mcpProxyFindRouteSource,
      mcpAuditRouteSource,
      mcpSignalsRouteSource,
      mcpSignalsGetRouteSource,
    ]) {
      expect(routeFile).not.toContain("next/");
      expect(routeFile).not.toContain("nuqs");
      expect(routeFile).not.toContain('"use client"');
      expect(routeFile).not.toContain('"use server"');
    }
  });
});
