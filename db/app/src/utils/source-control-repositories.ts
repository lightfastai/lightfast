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
  orgSourceControlBindings,
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

export interface CompleteWatchedSourceControlRepositorySetupInput
  extends UpsertWatchedSourceControlRepositoryInput {
  bindingMetadata: Record<string, unknown>;
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

export async function completeWatchedSourceControlRepositorySetup(
  db: Database,
  input: CompleteWatchedSourceControlRepositorySetupInput
): Promise<SourceControlRepository> {
  return await db.transaction(async (tx) => {
    const bindingResult = await tx
      .update(orgSourceControlBindings)
      .set({ metadata: input.bindingMetadata })
      .where(
        and(
          eq(orgSourceControlBindings.id, input.orgSourceControlBindingId),
          eq(orgSourceControlBindings.status, "active")
        )
      );
    if (getRowsAffected(bindingResult) === 0) {
      throw new Error(
        `Failed to store source control repository proof for binding ${input.orgSourceControlBindingId}.`
      );
    }

    return await upsertWatchedSourceControlRepository(tx, {
      fullName: input.fullName,
      orgSourceControlBindingId: input.orgSourceControlBindingId,
      providerRepositoryId: input.providerRepositoryId,
      watchedPathGlobs: input.watchedPathGlobs,
    });
  });
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
  if (getRowsAffected(result) > 0) {
    return true;
  }

  const delivery = await getSourceControlWebhookDeliveryByDeliveryId(db, {
    deliveryId: input.deliveryId,
  });
  return delivery?.status === input.status;
}

function getRowsAffected(result: unknown): number {
  if (Array.isArray(result)) {
    return result.reduce((total, item) => total + getRowsAffected(item), 0);
  }
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
