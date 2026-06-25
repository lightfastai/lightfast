import { db } from "@db/app/client";
import { decisionFindInputSchema } from "@repo/api-contract";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { clerkClient } from "@vendor/clerk/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import type { z } from "zod";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import { requireBoundClerkOrgActor } from "../../domain/gates";
import {
  type DecisionRecord,
  findDecisionRecords,
} from "../../services/decisions";
import { sanitizeProviderRoutinePayload } from "../../services/provider-routines/payload";

const listDecisionsInput = decisionFindInputSchema;

export type ListDecisionsInput = z.input<typeof listDecisionsInput>;

type DecisionListPage = Awaited<ReturnType<typeof findDecisionRecords>>;
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
  DecisionRecord,
  | "inputPayload"
  | "legacyInputRedacted"
  | "legacyOutputRedacted"
  | "outputPayload"
> & {
  calledByUsername: string | null;
  inputPayload: SerializablePayload | null;
  outputPayload: SerializablePayload | null;
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
  value: DecisionRecord["inputPayload"]
): SerializablePayload | null {
  if (!value) {
    return null;
  }

  const sanitized = sanitizeProviderRoutinePayload(value);
  if (!sanitized) {
    return null;
  }

  const payload = toSerializableValue(sanitized);
  return payload && !Array.isArray(payload) && typeof payload === "object"
    ? payload
    : null;
}

function serializeDecision(
  decision: DecisionRow,
  calledByUsername: string | null
): DecisionResult {
  const {
    inputPayload,
    legacyInputRedacted: _legacyInputRedacted,
    legacyOutputRedacted: _legacyOutputRedacted,
    outputPayload,
    ...rest
  } = decision;

  return {
    ...rest,
    calledByUsername,
    inputPayload: toSerializablePayload(inputPayload),
    outputPayload: toSerializablePayload(outputPayload),
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
      const page = await findDecisionRecords(db, {
        clerkOrgId: actor.orgId,
        cursor: data.cursor,
        limit: data.limit,
        query: data.query,
        providers: data.providers?.length ? data.providers : undefined,
        sourceSurfaces: data.sourceSurfaces?.length
          ? data.sourceSurfaces
          : undefined,
        statuses: data.statuses?.length ? data.statuses : undefined,
        since: data.since,
        until: data.until,
      });

      return withCallerUsernames(page);
    } catch (error) {
      mapTanStackError(error);
    }
  });
