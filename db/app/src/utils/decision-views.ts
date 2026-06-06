import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import {
  createDecisionViewId,
  type DecisionView,
  type DecisionViewConfig,
  orgDecisionViews as decisionViews,
} from "../schema";

export interface ListDecisionViewsParams {
  clerkOrgId: string;
  createdByUserId: string;
}

export async function listDecisionViews(
  db: Database,
  input: ListDecisionViewsParams
): Promise<DecisionView[]> {
  return db
    .select()
    .from(decisionViews)
    .where(
      and(
        eq(decisionViews.clerkOrgId, input.clerkOrgId),
        eq(decisionViews.createdByUserId, input.createdByUserId)
      )
    )
    .orderBy(desc(decisionViews.createdAt), desc(decisionViews.id));
}

export interface CreateDecisionViewParams {
  clerkOrgId: string;
  config: DecisionViewConfig;
  createdByUserId: string;
  name: string;
}

export async function createDecisionView(
  db: Database,
  input: CreateDecisionViewParams
): Promise<DecisionView> {
  const publicId = createDecisionViewId();
  await db.insert(decisionViews).values({
    publicId,
    clerkOrgId: input.clerkOrgId,
    createdByUserId: input.createdByUserId,
    name: input.name,
    config: input.config,
  });

  const [row] = await db
    .select()
    .from(decisionViews)
    .where(
      and(
        eq(decisionViews.publicId, publicId),
        eq(decisionViews.clerkOrgId, input.clerkOrgId)
      )
    )
    .limit(1);

  if (!row) {
    throw new Error(`Failed to create decision view ${publicId}`);
  }
  return row;
}

export interface DeleteDecisionViewParams {
  clerkOrgId: string;
  createdByUserId: string;
  publicId: string;
}

export async function deleteDecisionView(
  db: Database,
  input: DeleteDecisionViewParams
): Promise<boolean> {
  const result = await db
    .delete(decisionViews)
    .where(
      and(
        eq(decisionViews.publicId, input.publicId),
        eq(decisionViews.clerkOrgId, input.clerkOrgId),
        eq(decisionViews.createdByUserId, input.createdByUserId)
      )
    );
  return getRowsAffected(result) > 0;
}

function getRowsAffected(result: unknown): number {
  if (result === null || typeof result !== "object") {
    return 0;
  }
  const { affectedRows, rowsAffected } = result as {
    affectedRows?: unknown;
    rowsAffected?: unknown;
  };
  if (typeof rowsAffected === "number") {
    return rowsAffected;
  }
  if (typeof affectedRows === "number") {
    return affectedRows;
  }
  return 0;
}
