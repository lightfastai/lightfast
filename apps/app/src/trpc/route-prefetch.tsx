import { type DehydratedState, HydrationBoundary } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";

type RoutePrefetchInput =
  | { route: "account.githubTask" }
  | { route: "account.mcp" }
  | { route: "account.settings.general" }
  | { route: "account.settings.sourceControl" }
  | { route: "account.usernameTask" }
  | { route: "automations.detail"; automationId: string }
  | { route: "automations.list" }
  | { route: "automations.new" }
  | { route: "connectors" }
  | { route: "decisions" }
  | { route: "developerConnections" }
  | { route: "org.mcp" }
  | { route: "org.settings.apiKeys" }
  | { route: "org.settings.billing" }
  | { route: "org.settings.general"; slug: string }
  | { route: "org.settings.members" }
  | { route: "org.settings.sourceControl" }
  | { route: "people" }
  | { route: "signals" }
  | { route: "skills" }
  | { route: "tasks.bind"; slug: string }
  | { route: "tasks.index"; slug: string }
  | { route: "tasks.lightfastRepo"; slug: string }
  | { route: "tasks.xConnector"; slug: string };

type RoutePrefetchRoute = RoutePrefetchInput["route"];
type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
interface SerializableRoutePrefetchState {
  mutations: JsonValue[];
  queries: JsonValue[];
}

const ROUTES = new Set<RoutePrefetchRoute>([
  "account.githubTask",
  "account.mcp",
  "account.settings.general",
  "account.settings.sourceControl",
  "account.usernameTask",
  "automations.detail",
  "automations.list",
  "automations.new",
  "connectors",
  "decisions",
  "developerConnections",
  "org.mcp",
  "org.settings.apiKeys",
  "org.settings.billing",
  "org.settings.general",
  "org.settings.members",
  "org.settings.sourceControl",
  "people",
  "signals",
  "skills",
  "tasks.bind",
  "tasks.index",
  "tasks.lightfastRepo",
  "tasks.xConnector",
]);

function hasStringField(
  value: Record<string, unknown>,
  key: "automationId" | "slug"
) {
  return typeof value[key] === "string" && value[key].length > 0;
}

function validateRoutePrefetchInput(input: RoutePrefetchInput) {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid route prefetch input");
  }

  const record = input as Record<string, unknown>;
  const route = record.route;
  if (typeof route !== "string" || !ROUTES.has(route as RoutePrefetchRoute)) {
    throw new Error("Invalid route prefetch route");
  }

  if (route === "automations.detail") {
    if (!hasStringField(record, "automationId")) {
      throw new Error("Invalid automation route prefetch input");
    }
    return input;
  }

  if (
    (route === "org.settings.general" ||
      route === "tasks.bind" ||
      route === "tasks.index" ||
      route === "tasks.lightfastRepo" ||
      route === "tasks.xConnector") &&
    !hasStringField(record, "slug")
  ) {
    throw new Error("Invalid task route prefetch input");
  }

  return input;
}

function serializePrefetchState(
  state: DehydratedState
): SerializableRoutePrefetchState {
  return JSON.parse(JSON.stringify(state)) as SerializableRoutePrefetchState;
}

function createEmptyPrefetchState(): SerializableRoutePrefetchState {
  return { mutations: [], queries: [] };
}

function isDehydratedState(state: unknown): state is DehydratedState {
  if (!state || typeof state !== "object") {
    return false;
  }
  const candidate = state as { mutations?: unknown; queries?: unknown };
  return Array.isArray(candidate.mutations) && Array.isArray(candidate.queries);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isUnauthorizedTRPCError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  if (error.code === "UNAUTHORIZED") {
    return true;
  }

  const data = error.data;
  return isRecord(data) && data.code === "UNAUTHORIZED";
}

export const loadRoutePrefetch = createServerFn({ method: "GET" })
  .inputValidator(validateRoutePrefetchInput)
  .handler(async ({ data }) => {
    const [
      { dehydrate },
      { getRequest, setResponseHeader },
      { appRouter, createTRPCContext },
      { createTRPCOptionsProxy },
      { createQueryClient },
      accountPrefetch,
      automationsPrefetch,
      connectorsPrefetch,
      decisionsPrefetch,
      developerConnectionsPrefetch,
      orgPrefetch,
      peoplePrefetch,
      signalsPrefetch,
      skillsPrefetch,
    ] = await Promise.all([
      import("@tanstack/react-query"),
      import("@tanstack/react-start/server"),
      import("@api/app"),
      import("@trpc/tanstack-react-query"),
      import("~/trpc/query-client"),
      import("~/account/account-route-prefetch"),
      import("~/automations/automations-route-prefetch"),
      import("~/connectors/connectors-route-prefetch"),
      import("~/decisions/decisions-route-prefetch"),
      import("~/developer-connections/developer-connections-route-prefetch"),
      import("~/org/org-route-prefetch"),
      import("~/people/people-route-prefetch"),
      import("~/signals/signals-route-prefetch"),
      import("~/skills/skills-route-prefetch"),
    ]);

    const headers = new Headers(getRequest().headers);
    headers.set("x-trpc-source", "tanstack-route-loader");

    setResponseHeader("cache-control", "private, no-store");

    const queryClient = createQueryClient();
    const trpc = createTRPCOptionsProxy({
      router: appRouter,
      ctx: () => createTRPCContext({ headers }),
      queryClient: () => queryClient,
    });
    const prefetchContext: RoutePrefetchContext = { queryClient, trpc };

    try {
      switch (data.route) {
        case "account.githubTask":
        case "account.settings.sourceControl":
          await accountPrefetch.prefetchAccountGithubStatus(prefetchContext);
          break;
        case "account.mcp":
          await accountPrefetch.prefetchAccountMcpConnections(prefetchContext);
          break;
        case "account.settings.general":
        case "account.usernameTask":
          await accountPrefetch.prefetchAccountProfile(prefetchContext);
          break;
        case "automations.detail":
          await automationsPrefetch.prefetchAutomationDetailRoute(
            prefetchContext,
            data.automationId
          );
          break;
        case "automations.list":
          await automationsPrefetch.prefetchAutomationsListRoute(
            prefetchContext
          );
          break;
        case "automations.new":
          await automationsPrefetch.prefetchAutomationCreateRoute(
            prefetchContext
          );
          break;
        case "connectors":
          await connectorsPrefetch.prefetchConnectorsRoute(prefetchContext);
          break;
        case "decisions":
          await decisionsPrefetch.prefetchDecisionsRoute(prefetchContext);
          break;
        case "developerConnections":
          await developerConnectionsPrefetch.prefetchDeveloperConnectionsRoute(
            prefetchContext
          );
          break;
        case "org.mcp":
          await orgPrefetch.prefetchOrgMcpRoute(prefetchContext);
          break;
        case "org.settings.apiKeys":
          await orgPrefetch.prefetchOrgApiKeysRoute(prefetchContext);
          break;
        case "org.settings.billing":
          await orgPrefetch.prefetchOrgBillingRoute(prefetchContext);
          break;
        case "org.settings.general":
          await orgPrefetch.prefetchOrgGeneralSettingsRoute(
            prefetchContext,
            data.slug
          );
          break;
        case "org.settings.members":
          await orgPrefetch.prefetchOrgMembersRoute(prefetchContext);
          break;
        case "org.settings.sourceControl":
          await orgPrefetch.prefetchOrgSourceControlRoute(prefetchContext);
          break;
        case "people":
          await peoplePrefetch.prefetchPeopleRoute(prefetchContext);
          break;
        case "signals":
          await signalsPrefetch.prefetchSignalsRoute(prefetchContext);
          break;
        case "skills":
          await skillsPrefetch.prefetchSkillsRoute(prefetchContext);
          break;
        case "tasks.bind":
          await orgPrefetch.prefetchOrgSetupBindRoute(
            prefetchContext,
            data.slug
          );
          break;
        case "tasks.index":
        case "tasks.lightfastRepo":
          await orgPrefetch.prefetchOrgSetupIndexRoute(
            prefetchContext,
            data.slug
          );
          break;
        case "tasks.xConnector":
          await orgPrefetch.prefetchOrgSetupXConnectorRoute(
            prefetchContext,
            data.slug
          );
          break;
        default:
          throw new Error("Unsupported route prefetch route");
      }
    } catch (error) {
      if (isUnauthorizedTRPCError(error)) {
        return createEmptyPrefetchState();
      }
      throw error;
    }

    return serializePrefetchState(dehydrate(queryClient));
  });

export function RoutePrefetchBoundary({
  children,
  state,
}: {
  children: ReactNode;
  state: unknown;
}) {
  if (!isDehydratedState(state)) {
    return children;
  }

  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
