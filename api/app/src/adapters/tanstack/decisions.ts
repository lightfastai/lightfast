import { listProviderRoutineCalls, type ProviderRoutineCall } from "@db/app";
import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { clerkClient } from "@vendor/clerk/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import { requireBoundClerkOrgActor } from "../../domain/gates";

const DECISION_PROVIDERS = [
  "linear",
  "x",
] as const satisfies readonly ProviderRoutineCall["provider"][];
const DECISION_STATUSES = [
  "failed",
  "running",
  "succeeded",
] as const satisfies readonly ProviderRoutineCall["status"][];

const cursorCreatedAtSchema = z.union([
  z.date(),
  z
    .string()
    .datetime()
    .transform((value) => new Date(value)),
]);

const listDecisionsInput = z.object({
  cursor: z
    .object({
      createdAt: cursorCreatedAtSchema,
      id: z.number().int().positive(),
    })
    .nullish(),
  limit: z.number().int().min(1).max(100).optional(),
  providers: z
    .array(z.enum(DECISION_PROVIDERS))
    .max(DECISION_PROVIDERS.length)
    .optional(),
  search: z
    .string()
    .trim()
    .max(200)
    .transform((value) => value || undefined)
    .optional(),
  statuses: z
    .array(z.enum(DECISION_STATUSES))
    .max(DECISION_STATUSES.length)
    .optional(),
});

export type ListDecisionsInput = z.input<typeof listDecisionsInput>;

type DecisionListPage = Awaited<ReturnType<typeof listProviderRoutineCalls>>;
type DecisionRow = DecisionListPage["items"][number];

type SerializableValue =
  | SerializableValue[]
  | boolean
  | null
  | number
  | string
  | { [key: string]: SerializableValue };

interface SerializablePayload {
  [key: string]: SerializableValue;
}

export type DecisionResult = Omit<
  ProviderRoutineCall,
  "inputRedacted" | "outputRedacted"
> & {
  calledByUsername: string | null;
  inputRedacted: SerializablePayload | null;
  outputRedacted: SerializablePayload | null;
};

export interface ListDecisionsResult {
  items: DecisionResult[];
  nextCursor: DecisionListPage["nextCursor"];
}

function requestId() {
  return crypto.randomUUID();
}

async function getBoundActor() {
  const request = getRequest();
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });
  return requireBoundClerkOrgActor({
    actor: actorFromAuthIdentity(auth.identity, "web"),
    request: { id: requestId(), source: "tanstack" },
  });
}

function mapTanStackError(error: unknown): never {
  if (isDomainError(error)) {
    throw new Error(error.message, { cause: error });
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
  setResponseHeader("vary", "Cookie, Authorization");
}

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

function toSerializableValue(value: unknown): SerializableValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map(toSerializableValue);
  }

  if (typeof value === "object") {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        toSerializableValue(child),
      ])
    );
  }

  return null;
}

function toSerializablePayload(
  value: ProviderRoutineCall["inputRedacted"]
): SerializablePayload | null {
  if (!value) {
    return null;
  }

  const payload = toSerializableValue(value);
  return payload && !Array.isArray(payload) && typeof payload === "object"
    ? payload
    : null;
}

function serializeDecision(
  decision: DecisionRow,
  calledByUsername: string | null
): DecisionResult {
  return {
    ...decision,
    calledByUsername,
    inputRedacted: toSerializablePayload(decision.inputRedacted),
    outputRedacted: toSerializablePayload(decision.outputRedacted),
  };
}

async function withCallerUsernames(
  page: DecisionListPage
): Promise<ListDecisionsResult> {
  const userIds = [
    ...new Set(page.items.map(getCallerUserId).filter((id) => id !== null)),
  ];
  const usernamesById = await resolveClerkUsernames(userIds);

  return {
    ...page,
    items: page.items.map((decision) => {
      const userId = getCallerUserId(decision);
      return serializeDecision(
        decision,
        userId ? (usernamesById.get(userId) ?? null) : null
      );
    }),
  };
}

export const listDecisions = createServerFn({ method: "GET" })
  .inputValidator(listDecisionsInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      const actor = await getBoundActor();
      const page = await listProviderRoutineCalls(db, {
        clerkOrgId: actor.orgId,
        cursor: data.cursor,
        limit: data.limit,
        providers: data.providers?.length ? data.providers : undefined,
        search: data.search,
        statuses: data.statuses?.length ? data.statuses : undefined,
      });

      return withCallerUsernames(page);
    } catch (error) {
      mapTanStackError(error);
    }
  });
