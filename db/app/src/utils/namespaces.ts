import { lightfastHandleSchema } from "@repo/app-validation";
import { and, asc, eq, gt, isNotNull } from "drizzle-orm";
import { createMachine, transition } from "xstate";

import type { Database } from "../client";
import type {
  Namespace,
  NamespaceKind,
  NamespaceOperation,
  NamespaceOperationStatus,
  NamespaceOperationType,
} from "../schema";
import {
  systemNamespaceOperations as namespaceOperations,
  systemNamespaces as namespaces,
} from "../schema";
import { getRowsAffected, isDuplicateKeyError } from "./drizzle-results";

export type NamespaceOperationEvent =
  | { type: "RESERVE_NAMESPACE" }
  | { type: "MARK_CLERK_APPLIED" }
  | { type: "DELETE_PRE_CLERK_RESERVATION" }
  | { type: "FINALIZE" }
  | { type: "COMPENSATE" }
  | { type: "FAIL" };

export type NamespaceConflictCode =
  | "HANDLE_ALREADY_CLAIMED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "OWNER_ALREADY_CLAIMED"
  | "OWNER_NAMESPACE_IN_PROGRESS"
  | "OWNER_MISMATCH";

export class NamespaceConflictError extends Error {
  constructor(
    public readonly code: NamespaceConflictCode,
    message: string
  ) {
    super(message);
    this.name = "NamespaceConflictError";
  }
}

export class NamespaceOperationTransitionError extends Error {
  constructor(
    public readonly from: NamespaceOperationStatus,
    public readonly event: NamespaceOperationEvent
  ) {
    super(
      `Cannot transition namespace operation from ${from} via ${event.type}`
    );
    this.name = "NamespaceOperationTransitionError";
  }
}

export class NamespaceOperationConcurrencyError extends Error {
  constructor(
    public readonly operationId: number,
    public readonly expectedStatus: NamespaceOperationStatus,
    public readonly event: NamespaceOperationEvent
  ) {
    super(
      `Namespace operation ${operationId} was not in ${expectedStatus} for ${event.type}`
    );
    this.name = "NamespaceOperationConcurrencyError";
  }
}

export const namespaceOperationMachine = createMachine({
  id: "namespaceOperation",
  initial: "started",
  states: {
    clerk_applied: {
      on: {
        COMPENSATE: { target: "compensating" },
        FINALIZE: { target: "finalized" },
      },
    },
    compensating: {
      on: {
        FAIL: { target: "failed" },
        FINALIZE: { target: "finalized" },
      },
    },
    failed: {
      type: "final",
    },
    finalized: {
      type: "final",
    },
    namespace_reserved: {
      on: {
        DELETE_PRE_CLERK_RESERVATION: { target: "failed" },
        MARK_CLERK_APPLIED: { target: "clerk_applied" },
      },
    },
    started: {
      on: {
        FAIL: { target: "failed" },
        RESERVE_NAMESPACE: { target: "namespace_reserved" },
      },
    },
  },
});

export function isTerminalNamespaceOperationStatus(
  status: NamespaceOperationStatus
) {
  return status === "finalized" || status === "failed";
}

export function getNextNamespaceOperationStatus(
  status: NamespaceOperationStatus,
  event: NamespaceOperationEvent
): NamespaceOperationStatus {
  const current = namespaceOperationMachine.resolveState({
    context: {},
    value: status,
  });
  const [next] = transition(namespaceOperationMachine, current, event);
  const nextStatus = next.value;

  if (typeof nextStatus !== "string" || nextStatus === status) {
    throw new NamespaceOperationTransitionError(status, event);
  }

  return nextStatus as NamespaceOperationStatus;
}

export function canTransitionNamespaceOperation(
  status: NamespaceOperationStatus,
  event: NamespaceOperationEvent
) {
  try {
    getNextNamespaceOperationStatus(status, event);
    return true;
  } catch (error) {
    if (error instanceof NamespaceOperationTransitionError) {
      return false;
    }
    throw error;
  }
}

export interface StartNamespaceOperationInput {
  clerkOrgId?: string | null;
  clerkUserId?: string | null;
  fromHandle?: string | null;
  idempotencyKey: string;
  operationType: NamespaceOperationType;
  ownerKind: NamespaceKind;
  toHandle: string;
}

type NamespaceOperationIdempotencyInput = Pick<
  StartNamespaceOperationInput,
  | "clerkOrgId"
  | "clerkUserId"
  | "idempotencyKey"
  | "operationType"
  | "ownerKind"
>;

type NamespaceOperationPatch = Partial<
  Pick<
    NamespaceOperation,
    "clerkOrgId" | "clerkUserId" | "errorCode" | "errorMessage"
  >
>;

export async function getNamespaceOperationByIdempotencyKey(
  db: Database,
  input: NamespaceOperationIdempotencyInput
): Promise<NamespaceOperation | undefined> {
  const idempotencyOwner = getIdempotencyOwner(input);
  const ownerCondition = idempotencyOwner.clerkUserId
    ? eq(
        namespaceOperations.idempotencyClerkUserId,
        idempotencyOwner.clerkUserId
      )
    : eq(
        namespaceOperations.idempotencyClerkOrgId,
        getRequiredIdempotencyClerkOrgId(idempotencyOwner)
      );
  const [row] = await db
    .select()
    .from(namespaceOperations)
    .where(
      and(
        eq(namespaceOperations.idempotencyKey, input.idempotencyKey),
        eq(namespaceOperations.operationType, input.operationType),
        eq(namespaceOperations.ownerKind, input.ownerKind),
        ownerCondition
      )
    )
    .limit(1);
  return row;
}

export async function getNamespaceOperationById(
  db: Database,
  id: number
): Promise<NamespaceOperation | undefined> {
  const [row] = await db
    .select()
    .from(namespaceOperations)
    .where(eq(namespaceOperations.id, id))
    .limit(1);
  return row;
}

export async function getNamespaceByHandle(
  db: Database,
  handle: string
): Promise<Namespace | undefined> {
  const normalized = lightfastHandleSchema.parse(handle);
  const [row] = await db
    .select()
    .from(namespaces)
    .where(eq(namespaces.handle, normalized))
    .limit(1);
  return row;
}

export async function getActiveNamespaceByHandle(
  db: Database,
  handle: string
): Promise<Namespace | undefined> {
  const normalized = lightfastHandleSchema.parse(handle);
  const [row] = await db
    .select()
    .from(namespaces)
    .where(
      and(eq(namespaces.handle, normalized), eq(namespaces.status, "active"))
    )
    .limit(1);
  return row;
}

export interface ListActiveOrgNamespaceClerkOrgIdsInput {
  cursor?: number | null;
  limit: number;
}

export interface ActiveOrgNamespaceClerkOrgId {
  id: number;
  clerkOrgId: string;
}

export async function listActiveOrgNamespaceClerkOrgIds(
  db: Database,
  input: ListActiveOrgNamespaceClerkOrgIdsInput
): Promise<{
  items: ActiveOrgNamespaceClerkOrgId[];
  nextCursor: number | null;
}> {
  const limit =
    typeof input.limit === "number" && Number.isFinite(input.limit)
      ? Math.max(1, Math.min(Math.trunc(input.limit), 100))
      : 50;
  const rows = await db
    .select({
      id: namespaces.id,
      clerkOrgId: namespaces.clerkOrgId,
    })
    .from(namespaces)
    .where(
      and(
        eq(namespaces.kind, "org"),
        eq(namespaces.status, "active"),
        isNotNull(namespaces.clerkOrgId),
        input.cursor ? gt(namespaces.id, input.cursor) : undefined
      )
    )
    .orderBy(asc(namespaces.id))
    .limit(limit + 1);

  const items = rows.slice(0, limit).map((row) => ({
    id: row.id,
    clerkOrgId: row.clerkOrgId as string,
  }));
  const last = items.at(-1);

  return {
    items,
    nextCursor: rows.length > limit && last ? last.id : null,
  };
}

export async function getClaimedNamespaceForOwner(
  db: Database,
  operation: Pick<
    NamespaceOperation,
    "ownerKind" | "clerkOrgId" | "clerkUserId"
  >
): Promise<Namespace | undefined> {
  if (operation.ownerKind === "user" && operation.clerkUserId) {
    const [row] = await db
      .select()
      .from(namespaces)
      .where(eq(namespaces.claimedClerkUserId, operation.clerkUserId))
      .limit(1);
    return row;
  }

  if (operation.ownerKind === "org" && operation.clerkOrgId) {
    const [row] = await db
      .select()
      .from(namespaces)
      .where(eq(namespaces.claimedClerkOrgId, operation.clerkOrgId))
      .limit(1);
    return row;
  }

  return;
}

export async function startNamespaceOperation(
  db: Database,
  input: StartNamespaceOperationInput
): Promise<NamespaceOperation> {
  const fromHandle = input.fromHandle
    ? lightfastHandleSchema.parse(input.fromHandle)
    : null;
  const toHandle = lightfastHandleSchema.parse(input.toHandle);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const idempotencyOwner = getIdempotencyOwner(input);

  try {
    const inserted = await db
      .insert(namespaceOperations)
      .values({
        clerkOrgId: input.clerkOrgId ?? null,
        clerkUserId: input.clerkUserId ?? null,
        expiresAt,
        fromHandle,
        idempotencyClerkOrgId: idempotencyOwner.clerkOrgId,
        idempotencyClerkUserId: idempotencyOwner.clerkUserId,
        idempotencyKey: input.idempotencyKey,
        operationType: input.operationType,
        ownerKind: input.ownerKind,
        status: "started",
        toHandle,
      })
      .$returningId();

    const id = inserted[0]?.id;
    if (typeof id !== "number") {
      throw new Error("Failed to create namespace operation");
    }

    const operation = await getNamespaceOperationById(db, id);
    if (!operation) {
      throw new Error(`Failed to load namespace operation ${id}`);
    }
    return operation;
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
    const existing = await getNamespaceOperationByIdempotencyKey(db, input);
    if (!existing) {
      throw error;
    }
    assertSameOperationInput(existing, {
      ...input,
      fromHandle,
      toHandle,
    });
    return existing;
  }
}

type NamespaceReservationResult =
  | { ok: true; operation: NamespaceOperation }
  | { ok: false; code: NamespaceConflictCode; message: string };

export async function reserveNamespaceForOperation(
  db: Database,
  operation: NamespaceOperation
): Promise<NamespaceOperation> {
  if (operation.status !== "started") {
    return operation;
  }

  const result = await db.transaction(
    async (tx): Promise<NamespaceReservationResult> => {
      try {
        await tx
          .insert(namespaces)
          .values({
            activeOperationId: operation.id,
            claimedClerkOrgId: null,
            claimedClerkUserId:
              operation.ownerKind === "user" ? operation.clerkUserId : null,
            clerkOrgId: operation.clerkOrgId,
            clerkUserId: operation.clerkUserId,
            handle: operation.toHandle,
            kind: operation.ownerKind,
            status: "reserved",
          })
          .$returningId();
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }

        const existing = await getNamespaceByHandle(
          tx as Database,
          operation.toHandle
        );
        if (
          existing &&
          isSameNamespaceOwner(existing, operation) &&
          existing.activeOperationId === operation.id
        ) {
          const latest = await getNamespaceOperationById(
            tx as Database,
            operation.id
          );
          if (latest && latest.status !== "started") {
            return { ok: true, operation: latest };
          }
          return {
            ok: true,
            operation: await transitionNamespaceOperation(
              tx as Database,
              operation,
              { type: "RESERVE_NAMESPACE" }
            ),
          };
        }
        if (existing && isSameNamespaceOwner(existing, operation)) {
          return await failReservationWithConflict(
            tx as Database,
            operation,
            existing.status === "reserved"
              ? "OWNER_NAMESPACE_IN_PROGRESS"
              : "OWNER_ALREADY_CLAIMED",
            existing.status === "reserved"
              ? "Owner already has a namespace operation in progress"
              : "Owner already has a claimed namespace handle"
          );
        }
        if (existing) {
          return await failReservationWithConflict(
            tx as Database,
            operation,
            "HANDLE_ALREADY_CLAIMED",
            `Handle ${operation.toHandle} is already claimed`
          );
        }

        const ownerNamespace = await getClaimedNamespaceForOwner(
          tx as Database,
          operation
        );
        if (ownerNamespace) {
          return await failReservationWithConflict(
            tx as Database,
            operation,
            ownerNamespace.status === "reserved"
              ? "OWNER_NAMESPACE_IN_PROGRESS"
              : "OWNER_ALREADY_CLAIMED",
            ownerNamespace.status === "reserved"
              ? "Owner already has a namespace operation in progress"
              : "Owner already has a claimed namespace handle"
          );
        }
        return await failReservationWithConflict(
          tx as Database,
          operation,
          "HANDLE_ALREADY_CLAIMED",
          `Handle ${operation.toHandle} is already claimed`
        );
      }

      return {
        ok: true,
        operation: await transitionNamespaceOperation(
          tx as Database,
          operation,
          { type: "RESERVE_NAMESPACE" }
        ),
      };
    }
  );

  if (!result.ok) {
    throw new NamespaceConflictError(result.code, result.message);
  }

  return result.operation;
}

export async function transitionNamespaceOperation(
  db: Database,
  operation: NamespaceOperation,
  event: NamespaceOperationEvent,
  patch: NamespaceOperationPatch = {}
): Promise<NamespaceOperation> {
  const nextStatus = getNextNamespaceOperationStatus(operation.status, event);
  const result = await db
    .update(namespaceOperations)
    .set({
      ...patch,
      status: nextStatus,
    })
    .where(
      and(
        eq(namespaceOperations.id, operation.id),
        eq(namespaceOperations.status, operation.status)
      )
    );

  if (getRowsAffected(result) === 0) {
    throw new NamespaceOperationConcurrencyError(
      operation.id,
      operation.status,
      event
    );
  }

  const updated = await getNamespaceOperationById(db, operation.id);
  if (!updated) {
    throw new Error(`Failed to load namespace operation ${operation.id}`);
  }
  return updated;
}

export async function markNamespaceOperationClerkApplied(
  db: Database,
  operation: NamespaceOperation,
  patch: Pick<NamespaceOperationPatch, "clerkOrgId" | "clerkUserId"> = {}
): Promise<NamespaceOperation> {
  return await transitionNamespaceOperation(
    db,
    operation,
    {
      type: "MARK_CLERK_APPLIED",
    },
    patch
  );
}

export async function finalizeNamespaceOperation(
  db: Database,
  operation: NamespaceOperation
): Promise<NamespaceOperation> {
  return await db.transaction(async (tx) => {
    const namespacePatch = getNamespaceFinalizationPatch(operation);
    const namespaceResult = await tx
      .update(namespaces)
      .set({
        ...namespacePatch,
        activeOperationId: null,
        status: "active",
      })
      .where(
        and(
          eq(namespaces.handle, operation.toHandle),
          eq(namespaces.activeOperationId, operation.id),
          eq(namespaces.status, "reserved")
        )
      );

    if (getRowsAffected(namespaceResult) === 0) {
      throw new Error(
        `Failed to activate namespace ${operation.toHandle} for operation ${operation.id}`
      );
    }

    return await transitionNamespaceOperation(tx as Database, operation, {
      type: "FINALIZE",
    });
  });
}

export async function failUnreservedNamespaceOperation(
  db: Database,
  operation: NamespaceOperation,
  input: { errorCode: string; errorMessage: string }
): Promise<NamespaceOperation> {
  if (operation.status !== "started") {
    throw new Error("Only started namespace operations can be failed directly");
  }

  return await transitionNamespaceOperation(
    db,
    operation,
    { type: "FAIL" },
    {
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    }
  );
}

export async function deletePreClerkNamespaceReservation(
  db: Database,
  operation: NamespaceOperation,
  input: { errorCode: string; errorMessage: string }
): Promise<NamespaceOperation> {
  if (operation.status !== "namespace_reserved") {
    throw new Error(
      "Only namespace_reserved operations can delete a pre-Clerk namespace reservation"
    );
  }

  return await db.transaction(async (tx) => {
    const failed = await transitionNamespaceOperation(
      tx as Database,
      operation,
      { type: "DELETE_PRE_CLERK_RESERVATION" },
      {
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      }
    );

    if (failed.status !== "failed") {
      throw new Error(
        `Failed to mark namespace operation ${operation.id} failed before deleting reservation`
      );
    }

    const result = await tx
      .delete(namespaces)
      .where(
        and(
          eq(namespaces.handle, operation.toHandle),
          eq(namespaces.activeOperationId, operation.id),
          eq(namespaces.status, "reserved")
        )
      );

    if (getRowsAffected(result) === 0) {
      throw new Error(
        `Failed to delete namespace reservation ${operation.toHandle} for operation ${operation.id}`
      );
    }

    return failed;
  });
}

async function failReservationWithConflict(
  db: Database,
  operation: NamespaceOperation,
  code: NamespaceConflictCode,
  message: string
): Promise<NamespaceReservationResult> {
  await transitionNamespaceOperation(
    db,
    operation,
    { type: "FAIL" },
    {
      errorCode: code,
      errorMessage: message,
    }
  );
  return { ok: false, code, message };
}

function isSameNamespaceOwner(
  namespace: Namespace,
  operation: NamespaceOperation
) {
  if (namespace.kind !== operation.ownerKind) {
    return false;
  }

  if (operation.ownerKind === "user") {
    return (
      !!operation.clerkUserId && namespace.clerkUserId === operation.clerkUserId
    );
  }

  return (
    !!operation.clerkOrgId && namespace.clerkOrgId === operation.clerkOrgId
  );
}

function getNamespaceFinalizationPatch(operation: NamespaceOperation) {
  if (operation.ownerKind === "user") {
    if (!operation.clerkUserId) {
      throw new Error("User namespace finalization requires clerkUserId");
    }

    return {
      claimedClerkUserId: operation.clerkUserId,
      clerkUserId: operation.clerkUserId,
    };
  }

  if (!operation.clerkOrgId) {
    throw new Error("Org namespace finalization requires clerkOrgId");
  }

  return {
    claimedClerkOrgId: operation.clerkOrgId,
    clerkOrgId: operation.clerkOrgId,
  };
}

function getIdempotencyOwner(input: NamespaceOperationIdempotencyInput) {
  if (input.ownerKind === "user") {
    return {
      clerkOrgId: null,
      clerkUserId: getRequiredClerkUserId(input),
    };
  }

  if (!input.clerkOrgId && input.clerkUserId) {
    return {
      clerkOrgId: null,
      clerkUserId: input.clerkUserId,
    };
  }

  return {
    clerkOrgId: getRequiredClerkOrgId(input),
    clerkUserId: null,
  };
}

function getRequiredClerkUserId(input: NamespaceOperationIdempotencyInput) {
  if (!input.clerkUserId) {
    throw new Error("User namespace operations require clerkUserId");
  }
  return input.clerkUserId;
}

function getRequiredClerkOrgId(input: NamespaceOperationIdempotencyInput) {
  if (!input.clerkOrgId) {
    throw new Error("Org namespace operations require clerkOrgId");
  }
  return input.clerkOrgId;
}

function getRequiredIdempotencyClerkOrgId(input: {
  clerkOrgId: string | null;
}) {
  if (!input.clerkOrgId) {
    throw new Error("Namespace operation idempotency requires an owner id");
  }
  return input.clerkOrgId;
}

function assertSameOperationInput(
  existing: NamespaceOperation,
  input: StartNamespaceOperationInput
) {
  const same =
    (existing.fromHandle ?? null) === (input.fromHandle ?? null) &&
    existing.operationType === input.operationType &&
    existing.ownerKind === input.ownerKind &&
    existing.toHandle === input.toHandle &&
    (existing.clerkUserId ?? null) === (input.clerkUserId ?? null) &&
    (existing.clerkOrgId ?? null) === (input.clerkOrgId ?? null);

  if (!same) {
    throw new NamespaceConflictError(
      "IDEMPOTENCY_KEY_REUSED",
      "This namespace operation key was already used with different input"
    );
  }
}
