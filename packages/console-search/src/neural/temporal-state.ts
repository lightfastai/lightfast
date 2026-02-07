import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { db } from "@db/console/client";
import { workspaceTemporalStates } from "@db/console/schema";
import type {
  WorkspaceTemporalState,
  InsertWorkspaceTemporalState,
  TemporalEntityType,
  TemporalStateType,
} from "@db/console/schema";

/**
 * Get the state of an entity at a specific point in time
 * Uses bi-temporal query: validFrom <= pointInTime < validTo (or validTo is null)
 */
export async function getStateAt(
  workspaceId: string,
  entityType: TemporalEntityType,
  entityId: string,
  stateType: TemporalStateType,
  pointInTime: Date
): Promise<WorkspaceTemporalState | null> {
  const [state] = await db
    .select()
    .from(workspaceTemporalStates)
    .where(
      and(
        eq(workspaceTemporalStates.workspaceId, workspaceId),
        eq(workspaceTemporalStates.entityType, entityType),
        eq(workspaceTemporalStates.entityId, entityId),
        eq(workspaceTemporalStates.stateType, stateType),
        lte(workspaceTemporalStates.validFrom, pointInTime.toISOString()),
        or(
          isNull(workspaceTemporalStates.validTo),
          gt(workspaceTemporalStates.validTo, pointInTime.toISOString())
        )
      )
    )
    .limit(1);

  return state ?? null;
}

/**
 * Get the current state of an entity (uses isCurrent flag for fast lookup)
 */
export async function getCurrentState(
  workspaceId: string,
  entityType: TemporalEntityType,
  entityId: string,
  stateType: TemporalStateType
): Promise<WorkspaceTemporalState | null> {
  const [state] = await db
    .select()
    .from(workspaceTemporalStates)
    .where(
      and(
        eq(workspaceTemporalStates.workspaceId, workspaceId),
        eq(workspaceTemporalStates.entityType, entityType),
        eq(workspaceTemporalStates.entityId, entityId),
        eq(workspaceTemporalStates.stateType, stateType),
        eq(workspaceTemporalStates.isCurrent, true)
      )
    )
    .limit(1);

  return state ?? null;
}

/**
 * Get state history for an entity (all state changes over time)
 */
export async function getStateHistory(
  workspaceId: string,
  entityType: TemporalEntityType,
  entityId: string,
  stateType: TemporalStateType,
  limit = 50
): Promise<WorkspaceTemporalState[]> {
  return db
    .select()
    .from(workspaceTemporalStates)
    .where(
      and(
        eq(workspaceTemporalStates.workspaceId, workspaceId),
        eq(workspaceTemporalStates.entityType, entityType),
        eq(workspaceTemporalStates.entityId, entityId),
        eq(workspaceTemporalStates.stateType, stateType)
      )
    )
    .orderBy(desc(workspaceTemporalStates.validFrom))
    .limit(limit);
}

/**
 * Record a new state change (closes previous state, opens new one)
 * Uses transaction for atomicity
 */
export async function recordStateChange(
  input: Omit<InsertWorkspaceTemporalState, "id" | "isCurrent" | "createdAt" | "validTo">
): Promise<WorkspaceTemporalState> {
  return db.transaction(async (tx) => {
    // 1. Close the previous current state (if exists)
    await tx
      .update(workspaceTemporalStates)
      .set({
        isCurrent: false,
        validTo: input.validFrom, // Previous state ends when new one begins
      })
      .where(
        and(
          eq(workspaceTemporalStates.workspaceId, input.workspaceId),
          eq(workspaceTemporalStates.entityType, input.entityType),
          eq(workspaceTemporalStates.entityId, input.entityId),
          eq(workspaceTemporalStates.stateType, input.stateType),
          eq(workspaceTemporalStates.isCurrent, true)
        )
      );

    // 2. Insert the new current state
    const [newState] = await tx
      .insert(workspaceTemporalStates)
      .values({
        ...input,
        isCurrent: true,
        validTo: null, // Current state has no end time
      })
      .returning();

    if (!newState) {
      throw new Error("Failed to insert new temporal state");
    }

    return newState;
  });
}

/**
 * Get all current states for entities of a type in a workspace
 * Useful for dashboard views
 */
export async function getAllCurrentStates(
  workspaceId: string,
  entityType: TemporalEntityType,
  stateType?: TemporalStateType
): Promise<WorkspaceTemporalState[]> {
  const conditions = [
    eq(workspaceTemporalStates.workspaceId, workspaceId),
    eq(workspaceTemporalStates.entityType, entityType),
    eq(workspaceTemporalStates.isCurrent, true),
  ];

  if (stateType) {
    conditions.push(eq(workspaceTemporalStates.stateType, stateType));
  }

  return db
    .select()
    .from(workspaceTemporalStates)
    .where(and(...conditions))
    .orderBy(desc(workspaceTemporalStates.validFrom));
}
