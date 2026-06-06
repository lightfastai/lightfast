import { listProviderRoutineCalls, type ProviderRoutineCall } from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";
import {
  workspaceListCursorInput,
  workspaceListLimitInput,
  workspaceListSearchInput,
} from "./workspace-list-input";

// Tie the filter enums to the DB unions so a schema change there is a compile
// error here, not a silent runtime drift.
const DECISION_PROVIDERS = [
  "linear",
  "x",
] as const satisfies readonly ProviderRoutineCall["provider"][];
const DECISION_STATUSES = [
  "failed",
  "running",
  "succeeded",
] as const satisfies readonly ProviderRoutineCall["status"][];

const listDecisionsInput = z.object({
  cursor: workspaceListCursorInput,
  limit: workspaceListLimitInput,
  providers: z
    .array(z.enum(DECISION_PROVIDERS))
    .max(DECISION_PROVIDERS.length)
    .optional(),
  search: workspaceListSearchInput,
  statuses: z
    .array(z.enum(DECISION_STATUSES))
    .max(DECISION_STATUSES.length)
    .optional(),
});

type DecisionListPage = Awaited<ReturnType<typeof listProviderRoutineCalls>>;
type DecisionRow = DecisionListPage["items"][number];

function getCallerUserId(decision: DecisionRow): string | null {
  if (decision.calledByKind !== "user") {
    return null;
  }
  return decision.calledByUserId ?? decision.calledById;
}

async function resolveClerkUsernames(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, string>();
  }

  try {
    const clerk = await clerkClient();
    const users = await clerk.users.getUserList({ userId: userIds });
    return new Map(
      users.data.flatMap((user) =>
        user.username ? [[user.id, user.username] as const] : []
      )
    );
  } catch (error: unknown) {
    log.warn("[decisions] caller username enrichment failed", {
      error: parseError(error),
      userIds,
    });
    return new Map<string, string>();
  }
}

async function withCallerUsernames(page: DecisionListPage): Promise<
  Omit<DecisionListPage, "items"> & {
    items: Array<ProviderRoutineCall & { calledByUsername: string | null }>;
  }
> {
  const userIds = [
    ...new Set(page.items.map(getCallerUserId).filter((id) => id !== null)),
  ];
  const usernamesById = await resolveClerkUsernames(userIds);

  return {
    ...page,
    items: page.items.map((decision) => {
      const userId = getCallerUserId(decision);
      return {
        ...decision,
        calledByUsername: userId ? (usernamesById.get(userId) ?? null) : null,
      };
    }),
  };
}

export const decisionsRouter = {
  list: boundOrgProcedure
    .input(listDecisionsInput)
    .query(async ({ ctx, input }) => {
      const page = await listProviderRoutineCalls(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        cursor: input.cursor,
        limit: input.limit,
        providers: input.providers?.length ? input.providers : undefined,
        search: input.search,
        statuses: input.statuses?.length ? input.statuses : undefined,
      });

      return withCallerUsernames(page);
    }),
} satisfies TRPCRouterRecord;
