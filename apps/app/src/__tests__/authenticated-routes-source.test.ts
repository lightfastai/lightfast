import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function expectSource(path: string) {
  expect(existsSync(resolve(appRoot, path)), `${path} should exist`).toBe(true);
  return source(path);
}

describe("app authenticated route migration", () => {
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
    const clientSource = source("src/account/team-create-client.tsx");

    expect(routeSource).toContain(
      'createFileRoute("/_authenticated/account/teams/new")'
    );
    expect(routeSource).toContain("CreateTeamClient");
    expect(clientSource).toContain("viewer.organization.create");
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
    const consentFunctionsSource = source("src/oauth/mcp-consent-functions.ts");
    const consentServerSource = source("src/oauth/mcp-consent.server.ts");
    const nativeRouteSource = source("src/routes/oauth/$client/start.tsx");
    const nativeOrgSelectSource = source(
      "src/oauth/native-auth-org-select.tsx"
    );
    const nativeFunctionsSource = source("src/oauth/native-auth-functions.ts");
    const nativeValidatorsSource = source(
      "src/oauth/native-auth-validators.ts"
    );

    expect(authorizeRouteSource).toContain(
      'createFileRoute("/oauth/authorize")'
    );
    expect(authorizeRouteSource).toContain("loadMcpConsentViewModel");
    expect(consentCardSource).toContain("useServerFn");
    expect(consentCardSource).toContain("approveMcpAuthorization");
    expect(consentCardSource).toContain("denyMcpAuthorization");
    expect(consentCardSource).toContain("window.location.assign(redirectUrl)");
    expect(consentFunctionsSource).toContain("createServerFn");
    expect(consentFunctionsSource).toContain("redirectToSignInForOAuth");
    expect(consentFunctionsSource).toContain(
      "return approveMcpAuthorizationRequest("
    );
    expect(consentFunctionsSource).toContain(
      "return denyMcpAuthorizationRequest("
    );
    expect(consentFunctionsSource).not.toContain("redirect({ href:");
    expect(consentServerSource).toContain(
      'import "@tanstack/react-start/server-only"'
    );
    expect(consentServerSource).toContain("issueMcpAuthorizationCode");
    expect(consentServerSource).toContain("requireUserOrgMembership");

    expect(nativeRouteSource).toContain(
      'createFileRoute("/oauth/$client/start")'
    );
    expect(nativeRouteSource).toContain("validateNativeAuthStartSearch");
    expect(nativeRouteSource).toContain("loadNativeAuthOrganizations");
    expect(nativeRouteSource).toContain("NativeAuthOrgSelect");
    expect(nativeOrgSelectSource).toContain(
      "native.auth.createAttempt.mutationOptions"
    );
    expect(nativeOrgSelectSource).toContain("withClerkDevBrowserContext");
    expect(nativeFunctionsSource).toContain(
      "trpc.native.auth.listOrganizations.queryOptions()"
    );
    expect(nativeFunctionsSource).toContain("redirectToSignInForOAuth");
    expect(nativeValidatorsSource).toContain("isLoopbackRedirectUri");

    for (const routeFile of [
      authorizeRouteSource,
      consentCardSource,
      consentFunctionsSource,
      consentServerSource,
      nativeRouteSource,
      nativeOrgSelectSource,
      nativeFunctionsSource,
      nativeValidatorsSource,
    ]) {
      expect(routeFile).not.toContain("next/");
      expect(routeFile).not.toContain('"use client"');
      expect(routeFile).not.toContain('"use server"');
    }
  });

  it("uses a pathless authenticated shell for account and org routes", () => {
    const shellSource = source("src/routes/_authenticated.tsx");
    const teamSwitcherSource = source("src/components/team-switcher.tsx");
    const appSidebarSource = source("src/components/app-sidebar.tsx");
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
    expect(shellSource).toContain('to: "/sign-in"');
    expect(shellSource).toContain("redirect_url: location.href");
    expect(shellSource).toContain("AUTH_ROUTE_PATHS");
    expect(shellSource).toContain("isAuthRoute");
    expect(teamSwitcherSource).toContain("function TeamSwitcherSlot()");
    expect(teamSwitcherSource).toContain("<TeamSwitcherSkeleton />");
    expect(teamSwitcherSource).toContain('from "@repo/ui/hooks/use-mounted"');
    expect(teamSwitcherSource).toContain("const mounted = useMounted();");
    expect(teamSwitcherSource).toContain("if (!mounted || isPending)");
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
    expect(appSidebarSource).not.toContain("showChatHistory");
    expect(orgRouteSource).toContain("WorkspaceRouteShell");
    expect(workspaceShellSource).toContain("getBySlug.queryOptions({ slug })");
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
    expect(workspaceShellSource).not.toContain("shouldShowWorkspaceChatHistory");
    expect(workspaceModelSource).not.toContain("shouldShowWorkspaceChatHistory");
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

  it("ports Signals without Next.js search or link assumptions", () => {
    const routeSource = source("src/routes/_authenticated/$slug/signals.tsx");
    const clientSource = source("src/signals/signals-client.tsx");
    const createDialogSource = source("src/signals/signal-create-dialog.tsx");
    const searchSource = source("src/signals/signals-search-params.ts");
    const querySource = source("src/signals/use-classified-signals-query.ts");
    const viewsSource = source("src/signals/signals-view-switcher.tsx");
    const viewQuerySource = source("src/signals/use-signal-views-query.ts");
    const viewSwitcherSource = source("src/components/views/view-switcher.tsx");

    expect(routeSource).toContain("validateSignalsSearch");
    expect(routeSource).toContain("createFileRoute");
    expect(routeSource).toContain("setSearchParams");
    expect(clientSource).toContain("SignalCreateDialog");
    expect(clientSource).toContain("SignalsViewSwitcher");
    expect(clientSource).toContain("signalDetailQueryOptions");
    expect(createDialogSource).toContain("createSignalMutationOptions");
    expect(createDialogSource).toContain("listUserOrganizations.queryOptions");
    expect(searchSource).toContain("validateSignalsSearch");
    expect(searchSource).toContain("parseSignalDispositions");
    expect(querySource).toContain("workingSetSignalsQueryOptions");
    expect(querySource).toContain("processingSignalsQueryOptions");
    expect(viewQuerySource).toContain("signals.views.list.queryOptions");
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
    const querySource = source("src/people/use-people-list-query.ts");
    const viewsSource = source("src/people/people-view-switcher.tsx");
    const viewQuerySource = source("src/people/use-people-views-query.ts");
    const toolbarSource = source("src/people/people-toolbar.tsx");
    const tableSource = source("src/people/people-table-view.tsx");
    const detailSource = source("src/people/people-detail-content.tsx");
    const emptySource = source("src/people/people-empty-state.tsx");

    expect(routeSource).toContain("validatePeopleSearch");
    expect(routeSource).toContain("createFileRoute");
    expect(routeSource).toContain("setSearchParams");
    expect(clientSource).toContain("PeopleToolbar");
    expect(clientSource).toContain("PeopleViewSwitcher");
    expect(clientSource).toContain("PeopleTableView");
    expect(clientSource).toContain("PeopleDetailSheet");
    expect(clientSource).toContain("usePeopleListQuery");
    expect(searchSource).toContain("validatePeopleSearch");
    expect(searchSource).toContain("parsePersonProviders");
    expect(querySource).toContain("people.list.infiniteQueryOptions");
    expect(querySource).toContain('enabled: typeof window !== "undefined"');
    expect(viewsSource).toContain("viewConfigToParamValues");
    expect(viewQuerySource).toContain("people.views.list.queryOptions");
    expect(toolbarSource).toContain("viewsSlot");
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

  it("ports Developer Connections without Next.js search assumptions", () => {
    const routeSource = expectSource(
      "src/routes/_authenticated/$slug/developer-connections.tsx"
    );
    const clientSource = expectSource(
      "src/developer-connections/developer-connections-client.tsx"
    );
    const searchSource = expectSource(
      "src/developer-connections/developer-connections-search-params.ts"
    );
    const modelSource = expectSource(
      "src/developer-connections/developer-connections-model.ts"
    );
    const iconsSource = expectSource(
      "src/developer-connections/developer-connection-icons.tsx"
    );
    const detailSource = expectSource(
      "src/developer-connections/developer-connection-detail-sheet.tsx"
    );

    expect(routeSource).toContain("validateDeveloperConnectionsSearch");
    expect(routeSource).toContain("createFileRoute");
    expect(routeSource).toContain(
      '"/_authenticated/$slug/developer-connections"'
    );
    expect(routeSource).toContain("setSearchParams");
    expect(clientSource).toContain("developerConnections.list.queryOptions");
    expect(clientSource).toContain(
      "developerConnections.connect.mutationOptions"
    );
    expect(clientSource).toContain(
      "developerConnections.startSentryAuth.mutationOptions"
    );
    expect(clientSource).toContain(
      "developerConnections.completeSentryAuth.mutationOptions"
    );
    expect(clientSource).toContain(
      "developerConnections.setSandboxEnabled.mutationOptions"
    );
    expect(clientSource).toContain(
      "developerConnections.disconnect.mutationOptions"
    );
    expect(searchSource).toContain("validateDeveloperConnectionsSearch");
    expect(modelSource).toContain("developerConnectionStatus");
    expect(iconsSource).toContain("DeveloperConnectionIcon");
    expect(detailSource).toContain("DeveloperConnectionDetailSheet");

    for (const routeFile of [
      routeSource,
      clientSource,
      searchSource,
      modelSource,
      iconsSource,
      detailSource,
    ]) {
      expect(routeFile).not.toContain("next/");
      expect(routeFile).not.toContain("nuqs");
      expect(routeFile).not.toContain('"use client"');
      expect(routeFile).not.toContain('"use server"');
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
    const decisionsQuerySource = source(
      "src/decisions/use-decisions-list-query.ts"
    );
    const skillsRouteSource = source(
      "src/routes/_authenticated/$slug/skills.tsx"
    );
    const skillsClientSource = source("src/skills/skills-client.tsx");
    const skillsSearchSource = source("src/skills/skills-search-params.ts");
    const skillsQuerySource = source("src/skills/use-skills-list-query.ts");
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
    const automationsQuerySource = source(
      "src/automations/use-automations-list-query.ts"
    );

    expect(decisionsRouteSource).toContain("validateDecisionsSearch");
    expect(decisionsRouteSource).toContain("setSearchParams");
    expect(decisionsClientSource).toContain("DecisionsToolbar");
    expect(decisionsClientSource).toContain("DecisionsTableView");
    expect(decisionsSearchSource).toContain("parseDecisionProviders");
    expect(decisionsQuerySource).toContain(
      "decisions.list.infiniteQueryOptions"
    );
    expect(decisionsQuerySource).toContain(
      'enabled: typeof window !== "undefined"'
    );

    expect(skillsRouteSource).toContain("validateSkillsSearch");
    expect(skillsRouteSource).toContain("setSearchParams");
    expect(skillsClientSource).toContain("SkillGrid");
    expect(skillsClientSource).toContain("SkillDialog");
    expect(skillsSearchSource).toContain("validateSkillsSearch");
    expect(skillsQuerySource).toContain("skills.list.queryOptions");
    expect(skillsQuerySource).toContain(
      'enabled: typeof window !== "undefined"'
    );

    expect(connectorsRouteSource).toContain("validateConnectorsSearch");
    expect(connectorsRouteSource).toContain("setSearchParams");
    expect(connectorsClientSource).toContain(
      "connectors.listSections.queryOptions"
    );
    expect(connectorsClientSource).toContain("startConnect.mutationOptions");
    expect(connectorsClientSource).toContain("userConnectors.startConnect");
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
      "automations.create.mutationOptions"
    );
    expect(automationsDetailSource).toContain("automations.get.queryOptions");
    expect(automationsQuerySource).toContain("automations.list.queryOptions");
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
    const resumableConfigSource = source("src/chat/resumable-stream-config.ts");

    expect(packageSource).toContain('"@ai-sdk/react": "catalog:"');
    expect(packageSource).toContain('"@vendor/ai": "workspace:*"');
    expect(chatRouteSource).toContain("component: Outlet");
    expect(chatIndexRouteSource).toContain(
      'createFileRoute("/_authenticated/$slug/chat/")'
    );
    expect(chatIndexRouteSource).toContain(
      "createWorkspaceAssistantConversationId"
    );
    expect(chatIndexRouteSource).toContain("WorkspaceAssistantClient");
    expect(chatIndexRouteSource).toContain("key={conversationId}");
    expect(chatRouteSource).not.toContain("WorkspacePage");
    expect(conversationRouteSource).toContain(
      "assistant.getConversation.queryOptions"
    );
    expect(conversationRouteSource).toContain("WorkspaceAssistantClient");
    expect(conversationRouteSource).toContain("isPreallocatedConversationId");
    expect(conversationRouteSource).toContain("notFound()");
    expect(assistantClientSource).toContain("useChat");
    expect(assistantClientSource).toContain("DefaultChatTransport");
    expect(assistantClientSource).toContain("useParams({ strict: false })");
    expect(assistantClientSource).toContain("useRouter");
    expect(assistantClientSource).toContain(
      'to: "/$slug/chat/$conversationId"'
    );
    expect(assistantClientSource).toContain("router.invalidate()");
    expect(assistantClientSource).toContain(
      "createConversation.mutationOptions"
    );
    expect(assistantClientSource).toContain("listConversations.queryFilter");
    expect(composerSource).toContain("PromptInput");
    expect(composerSource).toContain("PromptInputSubmit");
    expect(messageSource).toContain("ChatMessage");
    expect(messagePartSource).toContain("WorkspaceAssistantMessagePart");
    expect(copyButtonSource).toContain("extractMessageText");
    expect(resumableConfigSource).toContain("isResumableStreamEnabled");
    expect(resumableConfigSource).toContain("VITE_VERCEL_ENV");

    for (const routeFile of [
      chatRouteSource,
      chatIndexRouteSource,
      conversationRouteSource,
      assistantClientSource,
      composerSource,
      messageSource,
      messagePartSource,
      copyButtonSource,
      resumableConfigSource,
    ]) {
      expect(routeFile).not.toContain("next/");
      expect(routeFile).not.toContain("nuqs");
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
    expect(workspaceShellSource).toContain(
      "<AuthenticatedTopbar left={<TeamSwitcherSlot />} />"
    );
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
    expect(completeClientSource).toContain('result.bindingStatus !== "bound"');
    expect(completeClientSource).toContain("setFailed(true)");
    expect(setupCallbackSource).toContain("completeGitHubInstallationSetup");
    expect(oauthCallbackSource).toContain("completeGitHubOAuthVerification");

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
    const repositoryCardSource = source(
      "src/org/settings/source-control/repository-card.tsx"
    );
    const formatSource = source(
      "src/org/settings/source-control/source-control-format.ts"
    );
    const lfSelectSource = source("src/components/lf-select.tsx");

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
    expect(settingsClientSource).toContain(
      "org.settings.sourceControl.get.queryOptions"
    );
    expect(settingsClientSource).toContain(
      "org.settings.sourceControl.listRepositories.queryOptions"
    );
    expect(settingsClientSource).toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(settingsClientSource).toContain("SourceControlConnectionCard");
    expect(settingsClientSource).toContain("RepositoryList");
    expect(settingsClientSource).toContain('to="/$slug/tasks/bind"');
    expect(connectionCardSource).toContain(
      'to="/$slug/tasks/github/lightfast-repo"'
    );
    expect(repositoryListSource).toContain("useAuth");
    expect(repositoryListSource).toContain("AddRepositoryDialog");
    expect(repositoryListSource).toContain("RepositoryCard");
    expect(repositoryListSource).toContain("LfSelect");
    expect(addRepositoryDialogSource).toContain(
      "sourceControl.importRepository.mutationOptions"
    );
    expect(addRepositoryDialogSource).toContain("setQueryData");
    expect(addRepositoryDialogSource).toContain("LIGHTFAST_REPOSITORY_NAME");
    expect(repositoryCardSource).toContain("Open on GitHub");
    expect(formatSource).toContain("formatStatusSubtitle");
    expect(lfSelectSource).toContain("function LfSelect");

    for (const routeFile of [
      settingsLayoutSource,
      sourceControlRouteSource,
      settingsClientSource,
      connectionCardSource,
      repositoryListSource,
      addRepositoryDialogSource,
      repositoryCardSource,
      formatSource,
      lfSelectSource,
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
    const memberInviteActionsSource = source(
      "src/org/settings/members/org-member-invite-actions.ts"
    );
    const memberListActionsSource = source(
      "src/org/settings/members/org-member-list-actions.ts"
    );
    const memberCacheSource = source(
      "src/org/settings/members/org-member-cache.ts"
    );
    const apiKeyCreateSource = source(
      "src/org/settings/api-keys/org-api-key-create.tsx"
    );
    const apiKeyCreateActionsSource = source(
      "src/org/settings/api-keys/org-api-key-create-action.ts"
    );
    const apiKeyListSource = source(
      "src/org/settings/api-keys/org-api-key-list.tsx"
    );
    const apiKeyListActionsSource = source(
      "src/org/settings/api-keys/org-api-key-list-actions.ts"
    );
    const apiKeyCacheSource = source(
      "src/org/settings/api-keys/org-api-key-cache.ts"
    );
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
    expect(memberListSource).toContain("orgMembers.list.queryOptions");
    expect(memberListSource).toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(memberListSource).toContain('from "@clerk/tanstack-react-start"');
    expect(memberInviteSource).toContain("useOrgMemberInviteAction");
    expect(memberInviteActionsSource).toContain(
      "orgMembers.invite.mutationOptions"
    );
    expect(memberListActionsSource).toContain(
      "orgMembers.updateRole.mutationOptions"
    );
    expect(memberListActionsSource).toContain(
      "orgMembers.revokeInvitation.mutationOptions"
    );
    expect(memberListActionsSource).toContain(
      "orgMembers.remove.mutationOptions"
    );
    expect(memberCacheSource).toContain(
      'AppRouterOutputs["org"]["settings"]["orgMembers"]["list"]'
    );

    expect(apiKeyListSource).toContain("orgApiKeys.list.queryOptions");
    expect(apiKeyListSource).toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(apiKeyListSource).toContain('from "@clerk/tanstack-react-start"');
    expect(apiKeyCreateSource).toContain("useOrgApiKeyCreateAction");
    expect(apiKeyCreateActionsSource).toContain(
      "orgApiKeys.create.mutationOptions"
    );
    expect(apiKeyListActionsSource).toContain(
      "orgApiKeys.revoke.mutationOptions"
    );
    expect(apiKeyListActionsSource).toContain(
      "orgApiKeys.delete.mutationOptions"
    );
    expect(apiKeyCacheSource).toContain(
      'AppRouterOutputs["org"]["settings"]["orgApiKeys"]["list"]'
    );

    expect(mcpClientSource).toContain("mcpConnections.list.queryOptions");
    expect(mcpClientSource).toContain("mcpConnections.revoke.mutationOptions");
    expect(mcpClientSource).toContain('enabled: typeof window !== "undefined"');
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
      memberInviteActionsSource,
      memberListActionsSource,
      memberCacheSource,
      apiKeyCreateSource,
      apiKeyCreateActionsSource,
      apiKeyListSource,
      apiKeyListActionsSource,
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
    const teamGeneralActionsSource = source(
      "src/org/settings/general/team-general-settings-actions.ts"
    );
    const identityCardSource = source(
      "src/org/settings/general/identity-soul-card.tsx"
    );
    const identitySectionSource = source(
      "src/org/settings/general/identity-soul-section.tsx"
    );
    const billingClientSource = source(
      "src/org/settings/billing/billing-settings-client.tsx"
    );
    const billingActionsSource = source(
      "src/org/settings/billing/billing-overview-actions.ts"
    );
    const billingCancellationSource = source(
      "src/org/settings/billing/billing-cancellation-mutation.ts"
    );
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

    expect(teamGeneralClientSource).toContain(
      "listUserOrganizations.queryOptions"
    );
    expect(teamGeneralClientSource).toContain("listDomains.queryOptions");
    expect(teamGeneralClientSource).toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(teamGeneralClientSource).toContain("useNavigate");
    expect(teamGeneralActionsSource).toContain(
      "organization.updateName.mutationOptions"
    );
    expect(teamGeneralActionsSource).toContain(
      "organization.updateDomains.mutationOptions"
    );
    expect(identityCardSource).toContain("identity.get.queryOptions");
    expect(identityCardSource).toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(identitySectionSource).toContain(
      'to="/$slug/settings/source-control"'
    );

    expect(billingClientSource).toContain("orgBilling.overview.queryOptions");
    expect(billingClientSource).toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(billingClientSource).toContain("usePaymentMethods");
    expect(billingClientSource).toContain("useStatements");
    expect(billingClientSource).toContain("BillingCheckoutDialog");
    expect(billingActionsSource).toContain("orgBilling.overview.queryFilter");
    expect(billingCancellationSource).toContain(
      "orgBilling.cancelSubscriptionItem.mutationOptions"
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
      teamGeneralActionsSource,
      identityCardSource,
      identitySectionSource,
      billingClientSource,
      billingActionsSource,
      billingCancellationSource,
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
    const openApiRouteSource = source("src/routes/api/v1/$.ts");
    const skillsIndexEventsRouteSource = source(
      "src/routes/api/skills/index/events.ts"
    );
    const skillsIndexEventStreamSource = source(
      "src/server/skills/skill-index-event-stream.ts"
    );
    const nativeProxyServerSource = source("src/server/native-proxy.ts");
    const nativeProxyCallRouteSource = source(
      "src/routes/api/native/proxy/call.ts"
    );
    const nativeProxyRoutinesRouteSource = source(
      "src/routes/api/native/proxy/routines.ts"
    );
    const mcpServiceAuthSource = source("src/server/mcp-service-auth.ts");
    const mcpProxyServerSource = source("src/server/mcp-proxy.ts");
    const mcpProxyCallRouteSource = source(
      "src/routes/api/internal/mcp/proxy/call.ts"
    );
    const mcpProxyFindRouteSource = source(
      "src/routes/api/internal/mcp/proxy/find.ts"
    );
    const mcpSignalsRouteSource = source(
      "src/routes/api/internal/mcp/signals.ts"
    );
    const mcpSignalsGetRouteSource = source(
      "src/routes/api/internal/mcp/signals/get.ts"
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
    expect(xSetupClientSource).toContain("connectors.list.queryOptions");
    expect(xSetupClientSource).toContain(
      'enabled: typeof window !== "undefined"'
    );
    expect(xSetupClientSource).toContain("ConnectorIcon");
    expect(xSetupClientSource).toContain("startConnect.mutationOptions");
    expect(xSetupClientSource).toContain("window.location.assign");
    expect(xCompleteClientSource).toContain("useSession");
    expect(xCompleteClientSource).toContain("useNavigate");
    expect(xCompleteClientSource).toContain("syncBindingClaim.mutationOptions");
    expect(xCompleteClientSource).toContain("pathForSetupRequirement");

    expect(githubWebhookRouteSource).toContain(
      'createFileRoute("/api/github/webhook")'
    );
    expect(githubWebhookRouteSource).toContain("handleGitHubWebhook");
    expect(openApiRouteSource).toContain('createFileRoute("/api/v1/$")');
    expect(openApiRouteSource).toContain("OpenAPIHandler");
    expect(openApiRouteSource).toContain("orpcRouter");
    expect(openApiRouteSource).toContain("setCorsHeaders");
    expect(skillsIndexEventsRouteSource).toContain(
      'createFileRoute("/api/skills/index/events")'
    );
    expect(skillsIndexEventsRouteSource).toContain(
      "createSkillIndexEventStream"
    );
    expect(skillsIndexEventStreamSource).toContain(
      "createSkillIndexEventStream"
    );
    expect(nativeProxyServerSource).toContain(
      "createNativeProviderRoutineContext"
    );
    expect(nativeProxyServerSource).toContain("loadAgentConnectorRuntimeTools");
    expect(nativeProxyServerSource).toContain("adapters");
    expect(nativeProxyServerSource).toContain('sourceSurface: "native_cli"');
    expect(nativeProxyCallRouteSource).toContain(
      'createFileRoute("/api/native/proxy/call")'
    );
    expect(nativeProxyCallRouteSource).toContain(
      "providerRoutineCallInputSchema"
    );
    expect(nativeProxyRoutinesRouteSource).toContain(
      'createFileRoute("/api/native/proxy/routines")'
    );
    expect(nativeProxyRoutinesRouteSource).toContain(
      "providerRoutineFindInputSchema"
    );
    expect(mcpServiceAuthSource).toContain("verifyMcpServiceRequest");
    expect(mcpProxyServerSource).toContain("handleMcpProxyFindRequest");
    expect(mcpProxyServerSource).toContain("handleMcpProxyCallRequest");
    expect(mcpProxyServerSource).toContain("loadAgentConnectorRuntimeTools");
    expect(mcpProxyServerSource).toContain("adapters");
    expect(mcpProxyServerSource).toContain('sourceSurface: "hosted_mcp"');
    expect(mcpProxyCallRouteSource).toContain(
      'createFileRoute("/api/internal/mcp/proxy/call")'
    );
    expect(mcpProxyFindRouteSource).toContain(
      'createFileRoute("/api/internal/mcp/proxy/find")'
    );
    expect(mcpSignalsRouteSource).toContain(
      'createFileRoute("/api/internal/mcp/signals")'
    );
    expect(mcpSignalsRouteSource).toContain("createSignalForActor");
    expect(mcpSignalsGetRouteSource).toContain(
      'createFileRoute("/api/internal/mcp/signals/get")'
    );
    expect(mcpSignalsGetRouteSource).toContain("getVisibleSignalByPublicId");

    for (const startupSensitiveFile of [
      openApiRouteSource,
      skillsIndexEventsRouteSource,
      nativeProxyServerSource,
      mcpServiceAuthSource,
      mcpProxyServerSource,
      mcpSignalsRouteSource,
      mcpSignalsGetRouteSource,
    ]) {
      expect(startupSensitiveFile).not.toContain('from "@api/app');
    }
    expect(mcpProxyServerSource).not.toContain(
      'from "@repo/provider-routines"'
    );

    for (const routeFile of [
      xSetupRouteSource,
      xCompleteRouteSource,
      xSetupClientSource,
      xCompleteClientSource,
      githubWebhookRouteSource,
      openApiRouteSource,
      skillsIndexEventsRouteSource,
      skillsIndexEventStreamSource,
      nativeProxyServerSource,
      nativeProxyCallRouteSource,
      nativeProxyRoutinesRouteSource,
      mcpServiceAuthSource,
      mcpProxyServerSource,
      mcpProxyCallRouteSource,
      mcpProxyFindRouteSource,
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
