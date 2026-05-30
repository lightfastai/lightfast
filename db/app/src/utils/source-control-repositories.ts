import type {
  SourceControlWebhookDeliveryStatus,
  WatchedPathGlobs,
} from "@repo/source-control-contract";
import { and, eq, getTableColumns } from "drizzle-orm";

import type { Database } from "../client";
import type {
  SourceControlRepository,
  SourceControlWebhookDelivery,
} from "../schema";
import {
  sourceControlRepositories,
  sourceControlWebhookDeliveries,
} from "../schema";

const repositorySelection = getTableColumns(sourceControlRepositories);
const deliverySelection = getTableColumns(sourceControlWebhookDeliveries);

export interface UpsertWatchedSourceControlRepositoryInput {
  fullName: string;
  orgSourceControlBindingId: number;
  providerRepositoryId: string;
  watchedPathGlobs: WatchedPathGlobs;
}

export async function getWatchedSourceControlRepository(
  db: Database,
  input: {
    orgSourceControlBindingId: number;
    providerRepositoryId: string;
  }
): Promise<SourceControlRepository | undefined> {
  const [row] = await db
    .select(repositorySelection)
    .from(sourceControlRepositories)
    .where(
      and(
        eq(
          sourceControlRepositories.orgSourceControlBindingId,
          input.orgSourceControlBindingId
        ),
        eq(
          sourceControlRepositories.providerRepositoryId,
          input.providerRepositoryId
        )
      )
    )
    .limit(1);
  return row;
}

export async function getWatchedSourceControlRepositoryById(
  db: Database,
  input: { id: number }
): Promise<SourceControlRepository | undefined> {
  const [row] = await db
    .select(repositorySelection)
    .from(sourceControlRepositories)
    .where(eq(sourceControlRepositories.id, input.id))
    .limit(1);
  return row;
}

export async function upsertWatchedSourceControlRepository(
  db: Database,
  input: UpsertWatchedSourceControlRepositoryInput
): Promise<SourceControlRepository> {
  const existing = await getWatchedSourceControlRepository(db, {
    orgSourceControlBindingId: input.orgSourceControlBindingId,
    providerRepositoryId: input.providerRepositoryId,
  });
  if (existing) {
    return existing;
  }

  await db.insert(sourceControlRepositories).values({
    fullName: input.fullName,
    orgSourceControlBindingId: input.orgSourceControlBindingId,
    providerRepositoryId: input.providerRepositoryId,
    watchedPathGlobs: input.watchedPathGlobs,
  });

  const inserted = await getWatchedSourceControlRepository(db, {
    orgSourceControlBindingId: input.orgSourceControlBindingId,
    providerRepositoryId: input.providerRepositoryId,
  });
  if (!inserted) {
    throw new Error(
      `Failed to create watched repository ${input.providerRepositoryId}`
    );
  }
  return inserted;
}

export async function getSourceControlWebhookDeliveryByDeliveryId(
  db: Database,
  input: { deliveryId: string }
): Promise<SourceControlWebhookDelivery | undefined> {
  const [row] = await db
    .select(deliverySelection)
    .from(sourceControlWebhookDeliveries)
    .where(eq(sourceControlWebhookDeliveries.deliveryId, input.deliveryId))
    .limit(1);
  return row;
}

export async function recordSourceControlWebhookDeliveryReceived(
  db: Database,
  input: {
    deliveryId: string;
    event: string;
    providerInstallationId: string;
    providerRepositoryId: string;
  }
): Promise<SourceControlWebhookDelivery> {
  const existing = await getSourceControlWebhookDeliveryByDeliveryId(db, {
    deliveryId: input.deliveryId,
  });
  if (existing) {
    return existing;
  }

  await db.insert(sourceControlWebhookDeliveries).values({
    deliveryId: input.deliveryId,
    event: input.event,
    providerInstallationId: input.providerInstallationId,
    providerRepositoryId: input.providerRepositoryId,
    status: "received",
  });

  const inserted = await getSourceControlWebhookDeliveryByDeliveryId(db, {
    deliveryId: input.deliveryId,
  });
  if (!inserted) {
    throw new Error(`Failed to create webhook delivery ${input.deliveryId}`);
  }
  return inserted;
}

export async function markSourceControlWebhookDeliveryStatus(
  db: Database,
  input: {
    deliveryId: string;
    status: SourceControlWebhookDeliveryStatus;
  }
): Promise<boolean> {
  const result = await db
    .update(sourceControlWebhookDeliveries)
    .set({ status: input.status })
    .where(eq(sourceControlWebhookDeliveries.deliveryId, input.deliveryId));
  return getRowsAffected(result) > 0;
}

export async function updateWatchedSourceControlRepositoryLastSeenSha(
  db: Database,
  input: { id: number; lastSeenSha: string }
): Promise<boolean> {
  const result = await db
    .update(sourceControlRepositories)
    .set({ lastSeenSha: input.lastSeenSha })
    .where(eq(sourceControlRepositories.id, input.id));
  return getRowsAffected(result) > 0;
}

export async function updateWatchedSourceControlRepositoryLastProcessedSha(
  db: Database,
  input: { id: number; lastProcessedSha: string }
): Promise<boolean> {
  const result = await db
    .update(sourceControlRepositories)
    .set({ lastProcessedSha: input.lastProcessedSha })
    .where(eq(sourceControlRepositories.id, input.id));
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
