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

export interface RecordSourceControlWebhookDeliveryReceivedResult {
  created: boolean;
  delivery: SourceControlWebhookDelivery;
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

  let duplicateError: unknown;
  await db
    .insert(sourceControlRepositories)
    .values({
      fullName: input.fullName,
      orgSourceControlBindingId: input.orgSourceControlBindingId,
      providerRepositoryId: input.providerRepositoryId,
      watchedPathGlobs: input.watchedPathGlobs,
    })
    .catch((error: unknown) => {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      duplicateError = error;
    });

  const inserted = await getWatchedSourceControlRepository(db, {
    orgSourceControlBindingId: input.orgSourceControlBindingId,
    providerRepositoryId: input.providerRepositoryId,
  });
  if (!inserted) {
    if (duplicateError) {
      throw duplicateError;
    }
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
): Promise<RecordSourceControlWebhookDeliveryReceivedResult> {
  const existing = await getSourceControlWebhookDeliveryByDeliveryId(db, {
    deliveryId: input.deliveryId,
  });
  if (existing) {
    return { delivery: existing, created: false };
  }

  let duplicateError: unknown;
  await db
    .insert(sourceControlWebhookDeliveries)
    .values({
      deliveryId: input.deliveryId,
      event: input.event,
      providerInstallationId: input.providerInstallationId,
      providerRepositoryId: input.providerRepositoryId,
      status: "received",
    })
    .catch((error: unknown) => {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      duplicateError = error;
    });

  const inserted = await getSourceControlWebhookDeliveryByDeliveryId(db, {
    deliveryId: input.deliveryId,
  });
  if (!inserted) {
    if (duplicateError) {
      throw duplicateError;
    }
    throw new Error(`Failed to create webhook delivery ${input.deliveryId}`);
  }
  return { delivery: inserted, created: duplicateError === undefined };
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

export async function markWatchedSourceControlRepositoryPushProcessed(
  db: Database,
  input: {
    deliveryId: string;
    lastProcessedSha: string;
    repositoryWatchId: number;
  }
): Promise<void> {
  await db.transaction(async (tx) => {
    const repositoryResult = await tx
      .update(sourceControlRepositories)
      .set({ lastProcessedSha: input.lastProcessedSha })
      .where(eq(sourceControlRepositories.id, input.repositoryWatchId));
    if (getRowsAffected(repositoryResult) === 0) {
      throw new Error(
        `Failed to mark source control repository watch ${input.repositoryWatchId} processed.`
      );
    }

    const deliveryResult = await tx
      .update(sourceControlWebhookDeliveries)
      .set({ status: "processed" })
      .where(eq(sourceControlWebhookDeliveries.deliveryId, input.deliveryId));
    if (getRowsAffected(deliveryResult) === 0) {
      throw new Error(
        `Failed to mark source control webhook delivery ${input.deliveryId} processed.`
      );
    }
  });
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

function isDuplicateKeyError(error: unknown): boolean {
  if (error === null || typeof error !== "object") {
    return false;
  }

  const { body, code, message } = error as {
    body?: { code?: unknown };
    code?: unknown;
    message?: unknown;
  };

  return (
    body?.code === "ER_DUP_ENTRY" ||
    code === "ER_DUP_ENTRY" ||
    (typeof message === "string" && message.includes("Duplicate entry"))
  );
}
