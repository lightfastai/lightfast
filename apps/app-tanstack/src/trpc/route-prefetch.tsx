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
  | { route: "account.mcp" }
  | { route: "automations.detail"; automationId: string }
  | { route: "automations.list" }
  | { route: "automations.new" }
  | { route: "connectors" }
  | { route: "decisions" }
  | { route: "org.mcp" }
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
  "account.mcp",
  "automations.detail",
  "automations.list",
  "automations.new",
  "connectors",
  "decisions",
  "org.mcp",
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
    (route === "tasks.bind" ||
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

function isDehydratedState(state: unknown): state is DehydratedState {
  if (!state || typeof state !== "object") {
    return false;
  }
  const candidate = state as { mutations?: unknown; queries?: unknown };
  return Array.isArray(candidate.mutations) && Array.isArray(candidate.queries);
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

    switch (data.route) {
      case "account.mcp":
        await queryClient.fetchQuery(
          trpc.viewer.account.mcpConnections.list.queryOptions()
        );
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
          trpc.org.workspace.connectors.list.queryOptions()
        );
        break;
      case "decisions":
        await queryClient.fetchInfiniteQuery(
          trpc.org.workspace.decisions.list.infiniteQueryOptions(
            { limit: DECISIONS_PAGE_SIZE },
            {
              getNextPageParam: (lastPage) => lastPage.nextCursor,
              staleTime: 60_000,
            }
          )
        );
        break;
      case "org.mcp":
        await queryClient.fetchQuery(
          trpc.org.settings.mcpConnections.list.queryOptions()
        );
        break;
      case "people":
        await queryClient.fetchInfiniteQuery(
          trpc.org.workspace.people.list.infiniteQueryOptions(
            { limit: PEOPLE_PAGE_SIZE },
            {
              getNextPageParam: (lastPage) => lastPage.nextCursor,
              staleTime: 60_000,
            }
          )
        );
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
