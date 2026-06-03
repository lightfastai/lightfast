import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import {
  createSignalViewId,
  type SignalView,
  type SignalViewConfig,
  orgSignalViews as signalViews,
} from "../schema";

export interface ListSignalViewsParams {
  clerkOrgId: string;
  createdByUserId: string;
}

export async function listSignalViews(
  db: Database,
  input: ListSignalViewsParams
): Promise<SignalView[]> {
  return db
    .select()
    .from(signalViews)
    .where(
      and(
        eq(signalViews.clerkOrgId, input.clerkOrgId),
        eq(signalViews.createdByUserId, input.createdByUserId)
      )
    )
    .orderBy(desc(signalViews.createdAt), desc(signalViews.id));
}

export interface CreateSignalViewParams {
  clerkOrgId: string;
  config: SignalViewConfig;
  createdByUserId: string;
  name: string;
}

export async function createSignalView(
  db: Database,
  input: CreateSignalViewParams
): Promise<SignalView> {
  const publicId = createSignalViewId();
  await db.insert(signalViews).values({
    publicId,
    clerkOrgId: input.clerkOrgId,
    createdByUserId: input.createdByUserId,
    name: input.name,
    config: input.config,
  });

  const [row] = await db
    .select()
    .from(signalViews)
    .where(
      and(
        eq(signalViews.publicId, publicId),
        eq(signalViews.clerkOrgId, input.clerkOrgId)
      )
    )
    .limit(1);

  if (!row) {
    throw new Error(`Failed to create signal view ${publicId}`);
  }
  return row;
}

export interface DeleteSignalViewParams {
  clerkOrgId: string;
  createdByUserId: string;
  publicId: string;
}

export async function deleteSignalView(
  db: Database,
  input: DeleteSignalViewParams
): Promise<boolean> {
  const result = await db
    .delete(signalViews)
    .where(
      and(
        eq(signalViews.publicId, input.publicId),
        eq(signalViews.clerkOrgId, input.clerkOrgId),
        eq(signalViews.createdByUserId, input.createdByUserId)
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
