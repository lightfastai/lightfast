import type { SkillDiagnostic } from "@repo/skills-contract";
import { and, asc, eq, getTableColumns, isNull, lt, or, sql } from "drizzle-orm";

import type { Database } from "../client";
import type {
  InsertSkillIndexEntry,
  OrgSourceControlBinding,
  SkillIndexEntry,
  SkillIndexState,
  SourceControlRepository,
} from "../schema";
import {
  orgSourceControlBindings,
  skillIndexEntries,
  skillIndexStates,
  sourceControlRepositories,
} from "../schema";
import { getRowsAffected, isDuplicateKeyError } from "./drizzle-results";

const stateSelection = getTableColumns(skillIndexStates);
const entrySelection = getTableColumns(skillIndexEntries);
const bindingSelection = getTableColumns(orgSourceControlBindings);
const repositorySelection = getTableColumns(sourceControlRepositories);

export class SkillIndexRefreshLockLostError extends Error {
  constructor(stateId: number) {
    super(`Skill index refresh lock was lost for state ${stateId}.`);
    this.name = "SkillIndexRefreshLockLostError";
  }
}

export type ReplaceSkillIndexEntryInput = Omit<
  InsertSkillIndexEntry,
  "createdAt" | "id" | "skillIndexStateId" | "updatedAt"
>;

export interface ReplaceSkillIndexEntriesInput {
  entries: ReplaceSkillIndexEntryInput[];
  indexDiagnostics: SkillDiagnostic[];
  indexedAt: Date;
  indexedCommitSha: string;
  indexedTreeSha: string | null;
  lockToken: string;
  stateId: number;
}

export interface SkillIndexableSourceControlRepositoryCandidate {
  binding: OrgSourceControlBinding;
  repository: SourceControlRepository;
  state: SkillIndexState | null;
}

export async function createOrLoadSkillIndexState(
  db: Database,
  input: { sourceControlRepositoryId: number }
): Promise<SkillIndexState> {
  const existing = await getSkillIndexStateBySourceControlRepositoryId(db, input);
  if (existing) {
    return existing;
  }

  let duplicateError: unknown;
  await db
    .insert(skillIndexStates)
    .values({
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    })
    .catch((error: unknown) => {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      duplicateError = error;
    });

  const state = await getSkillIndexStateBySourceControlRepositoryId(db, input);
  if (!state) {
    if (duplicateError) {
      throw duplicateError;
    }
    throw new Error(
      `Failed to create skill index state for repository ${input.sourceControlRepositoryId}`
    );
  }
  return state;
}

export async function getSkillIndexStateBySourceControlRepositoryId(
  db: Database,
  input: { sourceControlRepositoryId: number }
): Promise<SkillIndexState | null> {
  const [row] = await db
    .select(stateSelection)
    .from(skillIndexStates)
    .where(
      eq(
        skillIndexStates.sourceControlRepositoryId,
        input.sourceControlRepositoryId
      )
    )
    .limit(1);
  return row ?? null;
}

export async function acquireSkillIndexRefreshLock(
  db: Database,
  input: {
    lockToken: string;
    now: Date;
    stateId: number;
    ttlSeconds: number;
  }
): Promise<boolean> {
  const refreshLockedUntil = new Date(
    input.now.getTime() + input.ttlSeconds * 1000
  );
  const result = await db
    .update(skillIndexStates)
    .set({
      lastRefreshStatus: "refreshing",
      refreshLockedUntil,
      refreshLockToken: input.lockToken,
    })
    .where(
      and(
        eq(skillIndexStates.id, input.stateId),
        or(
          isNull(skillIndexStates.refreshLockedUntil),
          lt(skillIndexStates.refreshLockedUntil, input.now)
        )
      )
    );
  return getRowsAffected(result) === 1;
}

export async function releaseSkillIndexRefreshLock(
  db: Database,
  input: { lockToken: string; stateId: number }
): Promise<number> {
  const result = await db
    .update(skillIndexStates)
    .set({
      refreshLockedUntil: null,
      refreshLockToken: null,
    })
    .where(
      and(
        eq(skillIndexStates.id, input.stateId),
        eq(skillIndexStates.refreshLockToken, input.lockToken)
      )
    );
  return getRowsAffected(result);
}

export async function replaceSkillIndexEntries(
  db: Database,
  input: ReplaceSkillIndexEntriesInput
): Promise<void> {
  await db.transaction(async (tx) => {
    const updateResult = await tx
      .update(skillIndexStates)
      .set({
        indexDiagnostics: input.indexDiagnostics,
        indexedAt: input.indexedAt,
        indexedCommitSha: input.indexedCommitSha,
        indexedTreeSha: input.indexedTreeSha,
        invalidSkillCount: input.entries.filter(
          (entry) => entry.validationStatus === "invalid"
        ).length,
        lastRefreshErrorCode: null,
        lastRefreshErrorMessage: null,
        lastRefreshFailedAt: null,
        lastRefreshStatus: "fresh",
        skillCount: input.entries.length,
      })
      .where(
        and(
          eq(skillIndexStates.id, input.stateId),
          eq(skillIndexStates.refreshLockToken, input.lockToken)
        )
      );

    if (getRowsAffected(updateResult) !== 1) {
      throw new SkillIndexRefreshLockLostError(input.stateId);
    }

    await tx
      .delete(skillIndexEntries)
      .where(eq(skillIndexEntries.skillIndexStateId, input.stateId));

    if (input.entries.length > 0) {
      await tx.insert(skillIndexEntries).values(
        input.entries.map((entry) => ({
          ...entry,
          skillIndexStateId: input.stateId,
        }))
      );
    }
  });
}

export async function markSkillIndexRefreshFailed(
  db: Database,
  input: {
    errorCode: string;
    errorMessage: string;
    failedAt: Date;
    lockToken: string;
    stateId: number;
  }
): Promise<void> {
  const result = await db
    .update(skillIndexStates)
    .set({
      lastRefreshErrorCode: input.errorCode,
      lastRefreshErrorMessage: input.errorMessage.slice(0, 512),
      lastRefreshFailedAt: input.failedAt,
      lastRefreshStatus: "failed",
    })
    .where(
      and(
        eq(skillIndexStates.id, input.stateId),
        eq(skillIndexStates.refreshLockToken, input.lockToken)
      )
    );
  if (getRowsAffected(result) !== 1) {
    throw new SkillIndexRefreshLockLostError(input.stateId);
  }
}

export async function updateSkillIndexRefCheck(
  db: Database,
  input: {
    githubRefEtag: string | null;
    lastCheckedAt: Date;
    lastCheckedCommitSha: string | null;
    sourceControlRepositoryId: number;
  }
): Promise<number> {
  const result = await db
    .update(skillIndexStates)
    .set({
      githubRefEtag: input.githubRefEtag,
      lastCheckedAt: input.lastCheckedAt,
      lastCheckedCommitSha: input.lastCheckedCommitSha,
    })
    .where(
      eq(
        skillIndexStates.sourceControlRepositoryId,
        input.sourceControlRepositoryId
      )
    );
  return getRowsAffected(result);
}

export async function markSkillIndexKnownStale(
  db: Database,
  input: { sourceControlRepositoryId: number }
): Promise<number> {
  const result = await db
    .update(skillIndexStates)
    .set({ lastRefreshStatus: "stale" })
    .where(
      eq(
        skillIndexStates.sourceControlRepositoryId,
        input.sourceControlRepositoryId
      )
    );
  return getRowsAffected(result);
}

export async function listSkillIndexEntries(
  db: Database,
  input: { stateId: number }
): Promise<SkillIndexEntry[]> {
  return await db
    .select(entrySelection)
    .from(skillIndexEntries)
    .where(eq(skillIndexEntries.skillIndexStateId, input.stateId))
    .orderBy(
      asc(skillIndexEntries.validationStatus),
      asc(skillIndexEntries.slug)
    );
}

export async function getSkillIndexEntryBySlug(
  db: Database,
  input: { slug: string; stateId: number }
): Promise<SkillIndexEntry | null> {
  const [row] = await db
    .select(entrySelection)
    .from(skillIndexEntries)
    .where(
      and(
        eq(skillIndexEntries.skillIndexStateId, input.stateId),
        eq(skillIndexEntries.slug, input.slug)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function listSkillIndexableSourceControlRepositoryCandidates(
  db: Database,
  input: { clerkOrgId?: string; limit: number }
): Promise<SkillIndexableSourceControlRepositoryCandidate[]> {
  return await db
    .select({
      binding: bindingSelection,
      repository: repositorySelection,
      state: stateSelection,
    })
    .from(sourceControlRepositories)
    .innerJoin(
      orgSourceControlBindings,
      eq(
        sourceControlRepositories.orgSourceControlBindingId,
        orgSourceControlBindings.id
      )
    )
    .leftJoin(
      skillIndexStates,
      eq(
        skillIndexStates.sourceControlRepositoryId,
        sourceControlRepositories.id
      )
    )
    .where(
      input.clerkOrgId
        ? and(
            eq(orgSourceControlBindings.status, "active"),
            eq(orgSourceControlBindings.clerkOrgId, input.clerkOrgId)
          )
        : eq(orgSourceControlBindings.status, "active")
    )
    .orderBy(
      sql`${skillIndexStates.lastCheckedAt} is null desc`,
      asc(skillIndexStates.lastCheckedAt)
    )
    .limit(input.limit);
}
