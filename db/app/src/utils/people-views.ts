import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import {
  createPeopleViewId,
  type PeopleView,
  type PeopleViewConfig,
  peopleViews,
} from "../schema";

export interface ListPeopleViewsParams {
  clerkOrgId: string;
  createdByUserId: string;
}

export async function listPeopleViews(
  db: Database,
  input: ListPeopleViewsParams
): Promise<PeopleView[]> {
  return db
    .select()
    .from(peopleViews)
    .where(
      and(
        eq(peopleViews.clerkOrgId, input.clerkOrgId),
        eq(peopleViews.createdByUserId, input.createdByUserId)
      )
    )
    .orderBy(desc(peopleViews.createdAt), desc(peopleViews.id));
}

export interface CreatePeopleViewParams {
  clerkOrgId: string;
  config: PeopleViewConfig;
  createdByUserId: string;
  name: string;
}

export async function createPeopleView(
  db: Database,
  input: CreatePeopleViewParams
): Promise<PeopleView> {
  const publicId = createPeopleViewId();
  await db.insert(peopleViews).values({
    publicId,
    clerkOrgId: input.clerkOrgId,
    createdByUserId: input.createdByUserId,
    name: input.name,
    config: input.config,
  });

  const [row] = await db
    .select()
    .from(peopleViews)
    .where(
      and(
        eq(peopleViews.publicId, publicId),
        eq(peopleViews.clerkOrgId, input.clerkOrgId)
      )
    )
    .limit(1);

  if (!row) {
    throw new Error(`Failed to create people view ${publicId}`);
  }
  return row;
}

export interface DeletePeopleViewParams {
  clerkOrgId: string;
  createdByUserId: string;
  publicId: string;
}

export async function deletePeopleView(
  db: Database,
  input: DeletePeopleViewParams
): Promise<boolean> {
  const result = await db
    .delete(peopleViews)
    .where(
      and(
        eq(peopleViews.publicId, input.publicId),
        eq(peopleViews.clerkOrgId, input.clerkOrgId),
        eq(peopleViews.createdByUserId, input.createdByUserId)
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
