import { type DehydratedState, HydrationBoundary } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { AUTOMATION_RUNS_PAGE_LIMIT } from "~/automations/automations-cache";
import { DECISIONS_PAGE_SIZE } from "~/decisions/decisions-model";
import { PEOPLE_PAGE_SIZE } from "~/people/people-model";
import {
  PROCESSING_SIGNALS_LIMIT,
  signalProcessingStatuses,
} from "~/signals/signals-model";

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
    ] = await Promise.all([
      import("@tanstack/react-query"),
      import("@tanstack/react-start/server"),
      import("@api/app"),
      import("@trpc/tanstack-react-query"),
      import("~/trpc/query-client"),
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

    try {
      switch (data.route) {
        case "account.githubTask":
        case "account.settings.sourceControl":
          await queryClient.fetchQuery(
            trpc.viewer.githubAccount.status.queryOptions()
          );
          break;
        case "account.mcp":
          await queryClient.fetchQuery(
            trpc.viewer.account.mcpConnections.list.queryOptions()
          );
          break;
        case "account.settings.general":
        case "account.usernameTask":
          await queryClient.fetchQuery(trpc.viewer.account.get.queryOptions());
          break;
        case "automations.detail":
          await Promise.all([
            queryClient.fetchQuery(
              trpc.org.workspace.automations.get.queryOptions({
                id: data.automationId,
              })
            ),
            queryClient.fetchQuery(
              trpc.org.workspace.automations.listRuns.queryOptions({
                id: data.automationId,
                limit: AUTOMATION_RUNS_PAGE_LIMIT,
              })
            ),
          ]);
          break;
        case "automations.list":
          await queryClient.fetchQuery(
            trpc.org.workspace.automations.list.queryOptions()
          );
          break;
        case "automations.new":
          await queryClient.fetchQuery(
            trpc.org.workspace.connectors.list.queryOptions()
          );
          break;
        case "connectors":
          await queryClient.fetchQuery(
            trpc.org.workspace.connectors.listSections.queryOptions()
          );
          break;
        case "decisions":
          await Promise.all([
            queryClient.fetchInfiniteQuery(
              trpc.org.workspace.decisions.list.infiniteQueryOptions(
                { limit: DECISIONS_PAGE_SIZE },
                {
                  getNextPageParam: (lastPage) => lastPage.nextCursor,
                  staleTime: 60_000,
                }
              )
            ),
            queryClient.fetchQuery({
              ...trpc.org.workspace.decisions.views.list.queryOptions(),
              staleTime: 60_000,
            }),
          ]);
          break;
        case "developerConnections":
          await queryClient.fetchQuery(
            trpc.org.workspace.developerConnections.list.queryOptions()
          );
          break;
        case "org.mcp":
          await queryClient.fetchQuery(
            trpc.org.settings.mcpConnections.list.queryOptions()
          );
          break;
        case "org.settings.apiKeys":
          await queryClient.fetchQuery(
            trpc.org.settings.orgApiKeys.list.queryOptions()
          );
          break;
        case "org.settings.billing":
          await queryClient.fetchQuery(
            trpc.org.settings.orgBilling.overview.queryOptions()
          );
          break;
        case "org.settings.general":
          await Promise.all([
            queryClient.fetchQuery(
              trpc.org.settings.identity.get.queryOptions()
            ),
            queryClient.fetchQuery(
              trpc.org.settings.organization.listDomains.queryOptions({
                slug: data.slug,
              })
            ),
            queryClient.fetchQuery(
              trpc.viewer.organization.listUserOrganizations.queryOptions()
            ),
          ]);
          break;
        case "org.settings.members":
          await queryClient.fetchQuery(
            trpc.org.settings.orgMembers.list.queryOptions()
          );
          break;
        case "org.settings.sourceControl":
          await Promise.all([
            queryClient.fetchQuery(
              trpc.org.settings.sourceControl.get.queryOptions()
            ),
            queryClient.fetchQuery(
              trpc.org.settings.sourceControl.listRepositories.queryOptions()
            ),
          ]);
          break;
        case "people":
          await Promise.all([
            queryClient.fetchInfiniteQuery(
              trpc.org.workspace.people.list.infiniteQueryOptions(
                { limit: PEOPLE_PAGE_SIZE },
                {
                  getNextPageParam: (lastPage) => lastPage.nextCursor,
                  staleTime: 60_000,
                }
              )
            ),
            queryClient.fetchQuery({
              ...trpc.org.workspace.people.views.list.queryOptions(),
              staleTime: 60_000,
            }),
          ]);
          break;
        case "signals":
          await Promise.all([
            queryClient.fetchQuery({
              ...trpc.org.workspace.signals.workingSet.queryOptions(),
              staleTime: 30_000,
            }),
            queryClient.fetchQuery({
              ...trpc.org.workspace.signals.list.queryOptions({
                limit: PROCESSING_SIGNALS_LIMIT,
                statuses: [...signalProcessingStatuses],
              }),
              staleTime: 5000,
            }),
            queryClient.fetchQuery({
              ...trpc.org.workspace.signals.views.list.queryOptions(),
              staleTime: 60_000,
            }),
          ]);
          break;
        case "skills":
          await queryClient.fetchQuery(
            trpc.org.workspace.skills.list.queryOptions(undefined, {
              staleTime: 0,
            })
          );
          break;
        case "tasks.bind":
          await queryClient.fetchQuery(
            trpc.viewer.organization.getBySlug.queryOptions({ slug: data.slug })
          );
          break;
        case "tasks.index":
        case "tasks.lightfastRepo":
          await Promise.all([
            queryClient.fetchQuery(
              trpc.viewer.organization.getBySlug.queryOptions({
                slug: data.slug,
              })
            ),
            queryClient.fetchQuery(
              trpc.org.settings.sourceControl.get.queryOptions()
            ),
          ]);
          break;
        case "tasks.xConnector":
          await Promise.all([
            queryClient.fetchQuery(
              trpc.viewer.organization.getBySlug.queryOptions({
                slug: data.slug,
              })
            ),
            queryClient.fetchQuery(
              trpc.org.workspace.connectors.list.queryOptions()
            ),
          ]);
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
