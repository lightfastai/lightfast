import {
  and,
  asc,
  eq,
  getTableColumns,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import type { Database } from "../client";
import type {
  IdentityIndexFile,
  IdentityIndexState,
  InsertIdentityIndexFile,
  OrgSourceControlBinding,
  SourceControlRepository,
} from "../schema";
import {
  orgIdentityIndexFiles as identityIndexFiles,
  orgIdentityIndexStates as identityIndexStates,
  orgSourceControlBindings,
  orgSourceControlRepositories as sourceControlRepositories,
} from "../schema";
import { getRowsAffected, isDuplicateKeyError } from "./drizzle-results";

const stateSelection = getTableColumns(identityIndexStates);
const fileSelection = getTableColumns(identityIndexFiles);
const bindingSelection = getTableColumns(orgSourceControlBindings);
const repositorySelection = getTableColumns(sourceControlRepositories);

export class IdentityIndexRefreshLockLostError extends Error {
  constructor(stateId: number) {
    super(`Identity index refresh lock was lost for state ${stateId}.`);
    this.name = "IdentityIndexRefreshLockLostError";
  }
}

export type ReplaceIdentityIndexFileInput = Omit<
  InsertIdentityIndexFile,
  "createdAt" | "id" | "identityIndexStateId" | "updatedAt"
>;

export interface ReplaceIdentityIndexFilesInput {
  files: ReplaceIdentityIndexFileInput[];
  indexDiagnostics: string[];
  indexedAt: Date;
  indexedCommitSha: string;
  indexedTreeSha: string | null;
  lockToken: string;
  stateId: number;
}

export interface IdentityIndexRefreshCandidate {
  binding: OrgSourceControlBinding;
  repository: SourceControlRepository;
  state: IdentityIndexState | null;
}

export async function createOrLoadIdentityIndexState(
  db: Database,
  input: { sourceControlRepositoryId: number }
): Promise<IdentityIndexState> {
  const existing = await getIdentityIndexStateBySourceControlRepositoryId(
    db,
    input
  );
  if (existing) {
    return existing;
  }

  let duplicateError: unknown;
  await db
    .insert(identityIndexStates)
    .values({
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    })
    .catch((error: unknown) => {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      duplicateError = error;
    });

  const state = await getIdentityIndexStateBySourceControlRepositoryId(
    db,
    input
  );
  if (!state) {
    if (duplicateError) {
      throw duplicateError;
    }
    throw new Error(
      `Failed to create identity index state for repository ${input.sourceControlRepositoryId}`
    );
  }
  return state;
}

export async function getIdentityIndexStateBySourceControlRepositoryId(
  db: Database,
  input: { sourceControlRepositoryId: number }
): Promise<IdentityIndexState | null> {
  const [row] = await db
    .select(stateSelection)
    .from(identityIndexStates)
    .where(
      eq(
        identityIndexStates.sourceControlRepositoryId,
        input.sourceControlRepositoryId
      )
    )
    .limit(1);
  return row ?? null;
}

export async function acquireIdentityIndexRefreshLock(
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
    .update(identityIndexStates)
    .set({
      lastRefreshStatus: "refreshing",
      refreshLockedUntil,
      refreshLockToken: input.lockToken,
    })
    .where(
      and(
        eq(identityIndexStates.id, input.stateId),
        or(
          isNull(identityIndexStates.refreshLockedUntil),
          lt(identityIndexStates.refreshLockedUntil, input.now)
        )
      )
    );
  return getRowsAffected(result) === 1;
}

export async function releaseIdentityIndexRefreshLock(
  db: Database,
  input: { lockToken: string; stateId: number }
): Promise<number> {
  const result = await db
    .update(identityIndexStates)
    .set({
      refreshLockedUntil: null,
      refreshLockToken: null,
    })
    .where(
      and(
        eq(identityIndexStates.id, input.stateId),
        eq(identityIndexStates.refreshLockToken, input.lockToken)
      )
    );
  return getRowsAffected(result);
}

export async function replaceIdentityIndexFiles(
  db: Database,
  input: ReplaceIdentityIndexFilesInput
): Promise<void> {
  await db.transaction(async (tx) => {
    const updateResult = await tx
      .update(identityIndexStates)
      .set({
        indexDiagnostics: input.indexDiagnostics,
        indexedAt: input.indexedAt,
        indexedCommitSha: input.indexedCommitSha,
        indexedTreeSha: input.indexedTreeSha,
        lastRefreshErrorCode: null,
        lastRefreshErrorMessage: null,
        lastRefreshFailedAt: null,
        lastRefreshStatus: "fresh",
        lastRefreshSucceededAt: input.indexedAt,
        missingFileCount: countFiles(input.files, "missing"),
        presentFileCount: countFiles(input.files, "present"),
        readErrorFileCount: countFiles(input.files, "read_error"),
        tooLargeFileCount: countFiles(input.files, "too_large"),
      })
      .where(
        and(
          eq(identityIndexStates.id, input.stateId),
          eq(identityIndexStates.refreshLockToken, input.lockToken)
        )
      );

    if (getRowsAffected(updateResult) !== 1) {
      throw new IdentityIndexRefreshLockLostError(input.stateId);
    }

    await tx
      .delete(identityIndexFiles)
      .where(eq(identityIndexFiles.identityIndexStateId, input.stateId));

    if (input.files.length > 0) {
      await tx.insert(identityIndexFiles).values(
        input.files.map((file) => ({
          ...file,
          identityIndexStateId: input.stateId,
        }))
      );
    }
  });
}

export async function markIdentityIndexRefreshFailed(
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
    .update(identityIndexStates)
    .set({
      lastRefreshErrorCode: input.errorCode,
      lastRefreshErrorMessage: input.errorMessage.slice(0, 512),
      lastRefreshFailedAt: input.failedAt,
      lastRefreshStatus: "failed",
    })
    .where(
      and(
        eq(identityIndexStates.id, input.stateId),
        eq(identityIndexStates.refreshLockToken, input.lockToken)
      )
    );
  if (getRowsAffected(result) !== 1) {
    throw new IdentityIndexRefreshLockLostError(input.stateId);
  }
}

export async function updateIdentityIndexRefCheck(
  db: Database,
  input: {
    githubRefEtag: string | null;
    lastCheckedAt: Date;
    lastCheckedCommitSha: string | null;
    sourceControlRepositoryId: number;
  }
): Promise<number> {
  const result = await db
    .update(identityIndexStates)
    .set({
      githubRefEtag: input.githubRefEtag,
      lastCheckedAt: input.lastCheckedAt,
      lastCheckedCommitSha: input.lastCheckedCommitSha,
    })
    .where(
      eq(
        identityIndexStates.sourceControlRepositoryId,
        input.sourceControlRepositoryId
      )
    );
  return getRowsAffected(result);
}

export async function markIdentityIndexKnownStale(
  db: Database,
  input: { sourceControlRepositoryId: number }
): Promise<number> {
  const result = await db
    .update(identityIndexStates)
    .set({ lastRefreshStatus: "stale" })
    .where(
      eq(
        identityIndexStates.sourceControlRepositoryId,
        input.sourceControlRepositoryId
      )
    );
  return getRowsAffected(result);
}

export async function listIdentityIndexFiles(
  db: Database,
  input: { stateId: number }
): Promise<IdentityIndexFile[]> {
  return await db
    .select(fileSelection)
    .from(identityIndexFiles)
    .where(eq(identityIndexFiles.identityIndexStateId, input.stateId))
    .orderBy(asc(identityIndexFiles.kind));
}

export async function listIdentityIndexRefreshCandidates(
  db: Database,
  input: { clerkOrgId?: string; limit: number }
): Promise<IdentityIndexRefreshCandidate[]> {
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
      identityIndexStates,
      eq(
        identityIndexStates.sourceControlRepositoryId,
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
      sql`${identityIndexStates.lastCheckedAt} is null desc`,
      asc(identityIndexStates.lastCheckedAt)
    )
    .limit(input.limit);
}

export async function getIdentityIndexRefreshCandidateById(
  db: Database,
  input: { clerkOrgId?: string; sourceControlRepositoryId: number }
): Promise<IdentityIndexRefreshCandidate | null> {
  const [row] = await db
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
      identityIndexStates,
      eq(
        identityIndexStates.sourceControlRepositoryId,
        sourceControlRepositories.id
      )
    )
    .where(
      input.clerkOrgId
        ? and(
            eq(sourceControlRepositories.id, input.sourceControlRepositoryId),
            eq(orgSourceControlBindings.status, "active"),
            eq(orgSourceControlBindings.clerkOrgId, input.clerkOrgId)
          )
        : and(
            eq(sourceControlRepositories.id, input.sourceControlRepositoryId),
            eq(orgSourceControlBindings.status, "active")
          )
    )
    .limit(1);
  return row ?? null;
}

function countFiles(
  files: ReplaceIdentityIndexFileInput[],
  status: ReplaceIdentityIndexFileInput["status"]
): number {
  return files.filter((file) => file.status === status).length;
}
