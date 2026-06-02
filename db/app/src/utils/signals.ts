import {
  normalizePersistedSignalClassification,
  type SignalClassification,
  type SignalVisibilityScope,
} from "@repo/api-contract";
import type { SignalClassificationMetadata } from "@repo/identity-contract";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, gte, inArray, lt, or } from "drizzle-orm";

import type { Database } from "../client";
import { createSignalId, type Signal, signals } from "../schema";
import { getRowsAffected } from "./drizzle-results";

const WORKSPACE_SIGNALS_WINDOW_DAYS = 30;
const WORKSPACE_SIGNALS_LIMIT = 2000;
const SIGNAL_SCAN_BATCH_SIZE = 500;

export interface ListCursor {
  createdAt: Date;
  id: number;
}

export interface ListResult<T> {
  items: T[];
  nextCursor: ListCursor | null;
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 50;
  }
  return Math.max(1, Math.min(Math.trunc(limit), 100));
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isLegacySignalClassification(
  classification: unknown
): classification is { schemaVersion: "signal.classification.v1" } {
  return (
    !!classification &&
    typeof classification === "object" &&
    (classification as { schemaVersion?: unknown }).schemaVersion ===
      "signal.classification.v1"
  );
}

function normalizeSignalRow<T extends Signal>(row: T): T {
  if (!isLegacySignalClassification(row.classification)) {
    return row;
  }

  const classification = normalizePersistedSignalClassification(
    row.classification
  );
  return {
    ...row,
    classification,
    visibilityScope:
      classification?.routing.visibility.scope ?? row.visibilityScope,
  };
}

function getEffectiveVisibilityScope(
  row: Pick<Signal, "classification" | "visibilityScope">
): SignalVisibilityScope {
  return (
    normalizePersistedSignalClassification(row.classification)?.routing
      .visibility.scope ?? row.visibilityScope
  );
}

function isVisibleToCurrentUser(
  row: Pick<Signal, "classification" | "createdByUserId" | "visibilityScope">,
  createdByUserId: string
): boolean {
  return (
    row.createdByUserId === createdByUserId ||
    getEffectiveVisibilityScope(row) === "team"
  );
}

function cursorCondition(
  cursor: ListCursor | null | undefined
): SQL | undefined {
  return cursor
    ? or(
        lt(signals.createdAt, cursor.createdAt),
        and(eq(signals.createdAt, cursor.createdAt), lt(signals.id, cursor.id))
      )
    : undefined;
}

export interface ListSignalsParams {
  clerkOrgId: string;
  createdByUserId: string;
  cursor?: ListCursor | null;
  limit?: number;
  statuses?: Signal["status"][];
}

export async function listSignals(
  db: Database,
  input: ListSignalsParams
): Promise<ListResult<Signal>> {
  const limit = normalizeLimit(input.limit);
  let cursor = input.cursor ?? null;
  const visibleRows: Signal[] = [];

  while (visibleRows.length < limit + 1) {
    const conditions = [
      eq(signals.clerkOrgId, input.clerkOrgId),
      input.statuses?.length
        ? inArray(signals.status, input.statuses)
        : undefined,
      cursorCondition(cursor),
    ].filter(isDefined);

    const rows = await db
      .select()
      .from(signals)
      .where(and(...conditions))
      .orderBy(desc(signals.createdAt), desc(signals.id))
      .limit(SIGNAL_SCAN_BATCH_SIZE);

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const normalized = normalizeSignalRow(row);
      if (isVisibleToCurrentUser(normalized, input.createdByUserId)) {
        visibleRows.push(normalized);
        if (visibleRows.length >= limit + 1) {
          break;
        }
      }
    }

    const lastRow = rows.at(-1);
    if (rows.length < SIGNAL_SCAN_BATCH_SIZE || !lastRow) {
      break;
    }
    cursor = { createdAt: lastRow.createdAt, id: lastRow.id };
  }

  const items = visibleRows.slice(0, limit);
  const lastItem = items.at(-1);
  return {
    items,
    nextCursor:
      visibleRows.length > limit && lastItem
        ? { createdAt: lastItem.createdAt, id: lastItem.id }
        : null,
  };
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface WorkspaceSignalListItem {
  classification: Omit<SignalClassification, "nextAction" | "rationale"> | null;
  createdAt: Date;
  createdByApiKeyId: string | null;
  createdByUserId: string;
  id: number;
  publicId: string;
  status: Signal["status"];
}

interface WorkspaceSignalListRow {
  classification: Signal["classification"];
  createdAt: Date;
  createdByApiKeyId: string | null;
  createdByUserId: string;
  id: number;
  publicId: string;
  status: Signal["status"];
  visibilityScope: SignalVisibilityScope;
}

export interface WorkspaceSignalsResult {
  items: WorkspaceSignalListItem[];
  limit: number;
  totalCount: number;
  truncated: boolean;
  windowDays: number;
}

export interface ListWorkspaceSignalsParams {
  clerkOrgId: string;
  createdByUserId: string;
}

function projectSignalClassification(
  classification: unknown
): WorkspaceSignalListItem["classification"] {
  const normalized = normalizePersistedSignalClassification(classification);
  if (!normalized) {
    return null;
  }
  // rationale/nextAction live in the JSON blob but are detail-only; strip them
  // so the working-set row stays a strict subset of the full signal.
  const { nextAction, rationale, ...projected } = normalized;
  return projected;
}

async function scanWorkspaceSignals(
  db: Database,
  clerkOrgId: string,
  createdByUserId: string,
  cutoff: Date
): Promise<{ rows: WorkspaceSignalListRow[]; totalCount: number }> {
  let cursor: ListCursor | null = null;
  const visibleRows: WorkspaceSignalListRow[] = [];
  let totalCount = 0;

  while (true) {
    const conditions: SQL[] = [
      eq(signals.clerkOrgId, clerkOrgId),
      eq(signals.status, "classified"),
      gte(signals.createdAt, cutoff),
      cursorCondition(cursor),
    ].filter(isDefined);

    const rows: WorkspaceSignalListRow[] = await db
      .select({
        classification: signals.classification,
        createdAt: signals.createdAt,
        createdByApiKeyId: signals.createdByApiKeyId,
        createdByUserId: signals.createdByUserId,
        id: signals.id,
        publicId: signals.publicId,
        status: signals.status,
        visibilityScope: signals.visibilityScope,
      })
      .from(signals)
      .where(and(...conditions))
      .orderBy(desc(signals.createdAt), desc(signals.id))
      .limit(WORKSPACE_SIGNALS_LIMIT + 1);

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      if (isVisibleToCurrentUser(row, createdByUserId)) {
        totalCount += 1;
        if (visibleRows.length < WORKSPACE_SIGNALS_LIMIT) {
          visibleRows.push(row);
        }
      }
    }

    const lastRow: WorkspaceSignalListRow | undefined = rows.at(-1);
    if (rows.length <= WORKSPACE_SIGNALS_LIMIT || !lastRow) {
      break;
    }
    cursor = { createdAt: lastRow.createdAt, id: lastRow.id };
  }

  return { rows: visibleRows, totalCount };
}

/**
 * Bounded, projected working set for the Signals UI: classified signals from the
 * last WORKSPACE_SIGNALS_WINDOW_DAYS days, newest-first, capped at
 * WORKSPACE_SIGNALS_LIMIT. The client filters/groups/sorts this set entirely in
 * memory. When the window exceeds the cap, `truncated` is true and `totalCount`
 * is the exact window size (computed lazily — the common case skips the count).
 */
export async function listWorkspaceSignals(
  db: Database,
  input: ListWorkspaceSignalsParams
): Promise<WorkspaceSignalsResult> {
  const cutoff = new Date(
    Date.now() - WORKSPACE_SIGNALS_WINDOW_DAYS * DAY_IN_MS
  );

  const result = await scanWorkspaceSignals(
    db,
    input.clerkOrgId,
    input.createdByUserId,
    cutoff
  );
  const truncated = result.totalCount > WORKSPACE_SIGNALS_LIMIT;
  const items: WorkspaceSignalListItem[] = result.rows.map((row) => ({
    classification: projectSignalClassification(row.classification),
    createdAt: row.createdAt,
    createdByApiKeyId: row.createdByApiKeyId,
    createdByUserId: row.createdByUserId,
    id: row.id,
    publicId: row.publicId,
    status: row.status,
  }));

  return {
    items,
    limit: WORKSPACE_SIGNALS_LIMIT,
    totalCount: result.totalCount,
    truncated,
    windowDays: WORKSPACE_SIGNALS_WINDOW_DAYS,
  };
}

export interface CreateSignalRecordInput {
  clerkOrgId: string;
  createdByApiKeyId: string | null;
  createdByUserId: string;
  input: string;
}

export async function createSignal(
  db: Database,
  input: CreateSignalRecordInput
): Promise<Signal> {
  const publicId = createSignalId();
  await db.insert(signals).values({
    publicId,
    clerkOrgId: input.clerkOrgId,
    createdByUserId: input.createdByUserId,
    createdByApiKeyId: input.createdByApiKeyId,
    visibilityScope: "user",
    input: input.input,
    status: "queued",
    classification: null,
  });

  const inserted = await getSignalByPublicId(db, {
    publicId,
    clerkOrgId: input.clerkOrgId,
  });
  if (!inserted) {
    throw new Error(`Failed to create signal ${publicId}`);
  }
  return inserted;
}

export interface GetSignalByPublicIdParams {
  clerkOrgId: string;
  publicId: string;
}

export async function getSignalByPublicId(
  db: Database,
  input: GetSignalByPublicIdParams
): Promise<Signal | undefined> {
  const [row] = await db
    .select()
    .from(signals)
    .where(
      and(
        eq(signals.publicId, input.publicId),
        eq(signals.clerkOrgId, input.clerkOrgId)
      )
    )
    .limit(1);
  return row ? normalizeSignalRow(row) : undefined;
}

export interface GetVisibleSignalByPublicIdParams
  extends GetSignalByPublicIdParams {
  createdByUserId: string;
}

export async function getVisibleSignalByPublicId(
  db: Database,
  input: GetVisibleSignalByPublicIdParams
): Promise<Signal | undefined> {
  const row = await getSignalByPublicId(db, input);
  if (!(row && isVisibleToCurrentUser(row, input.createdByUserId))) {
    return;
  }
  return row;
}

export interface ClaimSignalForClassificationParams {
  clerkOrgId: string;
  publicId: string;
}

export async function claimSignalForClassification(
  db: Database,
  input: ClaimSignalForClassificationParams
): Promise<boolean> {
  const result = await db
    .update(signals)
    .set({
      status: "processing",
      errorCode: null,
      errorMessage: null,
    })
    .where(
      and(
        eq(signals.publicId, input.publicId),
        eq(signals.clerkOrgId, input.clerkOrgId),
        eq(signals.status, "queued")
      )
    );
  return getRowsAffected(result) > 0;
}

export interface MarkSignalClassifiedParams {
  classification: SignalClassification;
  classificationMetadata?: SignalClassificationMetadata | null;
  clerkOrgId: string;
  publicId: string;
}

export async function markSignalClassified(
  db: Database,
  input: MarkSignalClassifiedParams
): Promise<boolean> {
  const result = await db
    .update(signals)
    .set({
      status: "classified",
      classification: input.classification,
      classificationMetadata: input.classificationMetadata ?? null,
      visibilityScope: input.classification.routing.visibility.scope,
      errorCode: null,
      errorMessage: null,
    })
    .where(
      and(
        eq(signals.publicId, input.publicId),
        eq(signals.clerkOrgId, input.clerkOrgId),
        eq(signals.status, "processing")
      )
    );
  return getRowsAffected(result) > 0;
}

export interface MarkSignalFailedParams {
  clerkOrgId: string;
  errorCode: string;
  errorMessage: string;
  publicId: string;
}

export async function markSignalFailed(
  db: Database,
  input: MarkSignalFailedParams
): Promise<boolean> {
  const result = await db
    .update(signals)
    .set({
      status: "failed",
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    })
    .where(
      and(
        eq(signals.publicId, input.publicId),
        eq(signals.clerkOrgId, input.clerkOrgId),
        inArray(signals.status, ["queued", "processing"])
      )
    );
  return getRowsAffected(result) > 0;
}
