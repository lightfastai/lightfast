import type { SkillIndexEntry, SkillIndexState } from "@db/app";
import { buildGitHubRepositoryUrl } from "@lightfast/connector-github/node";
import type { SkillDiagnostic } from "@repo/skills-contract";

import { getGitHubAppConfig } from "../github/config";
import { resolveSkillIndexServiceDeps } from "./deps";
import {
  checkSkillIndexCandidateRef,
  refreshSkillIndexSource,
} from "./refresh";
import { getVerifiedCandidateByRepositoryId } from "./repository";
import type { SkillIndexFreshness, SkillIndexServiceDeps } from "./types";

const SNAPSHOT_READ_MAX_ATTEMPTS = 3;

export async function getSkillIndexSnapshot(input: {
  clerkOrgId: string;
  deps?: SkillIndexServiceDeps;
  sourceControlRepositoryId: number;
  slug?: string;
}): Promise<{
  freshness: SkillIndexFreshness;
  indexDiagnostics: SkillDiagnostic[];
  repositoryUrl: string;
  skills: SkillIndexEntry[];
  snapshotVersion: string | null;
}> {
  const deps = resolveSkillIndexServiceDeps(input.deps);
  const candidate = await getVerifiedCandidateByRepositoryId(deps, {
    clerkOrgId: input.clerkOrgId,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  if (!candidate) {
    return {
      freshness: toFreshness(null, "unavailable"),
      indexDiagnostics: [],
      repositoryUrl: "",
      skills: [],
      snapshotVersion: null,
    };
  }

  const repositoryUrl = getRepositoryUrl(candidate.repository.fullName);
  const state =
    candidate.state ??
    (await deps.getSkillIndexStateBySourceControlRepositoryId(deps.db, {
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    }));

  if (!state) {
    return {
      freshness: toFreshness(null, "unavailable"),
      indexDiagnostics: [],
      repositoryUrl,
      skills: [],
      snapshotVersion: null,
    };
  }

  const snapshot = await readConsistentSnapshot(deps, {
    initialState: state,
    slug: input.slug,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  if (!snapshot.state) {
    return {
      freshness: toFreshness(null, "unavailable"),
      indexDiagnostics: [],
      repositoryUrl,
      skills: [],
      snapshotVersion: null,
    };
  }

  return {
    freshness: toFreshness(
      snapshot.state,
      deriveSnapshotStatus(snapshot.state)
    ),
    indexDiagnostics: snapshot.state.indexDiagnostics,
    repositoryUrl,
    skills: snapshot.entries,
    snapshotVersion: snapshot.snapshotVersion,
  };
}

export async function ensureFreshSkillIndexForRead(input: {
  clerkOrgId: string;
  deps?: SkillIndexServiceDeps;
  sourceControlRepositoryId: number;
  slug?: string;
}): Promise<{
  freshness: SkillIndexFreshness;
  indexDiagnostics: SkillDiagnostic[];
  repositoryUrl: string;
  skills: SkillIndexEntry[];
}> {
  const deps = resolveSkillIndexServiceDeps(input.deps);
  const candidate = await getVerifiedCandidateByRepositoryId(deps, {
    clerkOrgId: input.clerkOrgId,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  if (!candidate) {
    return {
      freshness: toFreshness(null, "unavailable"),
      indexDiagnostics: [],
      repositoryUrl: "",
      skills: [],
    };
  }

  const repositoryUrl = getRepositoryUrl(candidate.repository.fullName);
  let state =
    candidate.state ??
    (await deps.getSkillIndexStateBySourceControlRepositoryId(deps.db, {
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    }));

  if (state) {
    const ref = await checkSkillIndexCandidateRef({
      candidate,
      deps,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
    state = await deps.getSkillIndexStateBySourceControlRepositoryId(deps.db, {
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
    if (
      ref.status === "unchanged" &&
      state?.indexedCommitSha &&
      state.lastCheckedCommitSha &&
      state.indexedCommitSha === state.lastCheckedCommitSha
    ) {
      const entries = await readEntries(deps, {
        slug: input.slug,
        stateId: state.id,
      });
      return {
        freshness: toFreshness(state, "fresh"),
        indexDiagnostics: state.indexDiagnostics,
        repositoryUrl,
        skills: entries,
      };
    }
  }

  let entries = state
    ? await readEntries(deps, { slug: input.slug, stateId: state.id })
    : [];
  const budgetMs = entries.length > 0 ? 3000 : 10_000;
  const refresh = await refreshWithBudget({
    budgetMs,
    deps,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  if (refresh.status === "stale") {
    await deps.sleep(500);
  }

  state = await deps.getSkillIndexStateBySourceControlRepositoryId(deps.db, {
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  if (state) {
    entries = await readEntries(deps, {
      slug: input.slug,
      stateId: state.id,
    });
  }

  const status = deriveReadStatus({
    entries,
    refreshStatus: refresh.status,
    state,
  });
  return {
    freshness: toFreshness(state, status),
    indexDiagnostics: state?.indexDiagnostics ?? [],
    repositoryUrl,
    skills: entries,
  };
}

async function refreshWithBudget(input: {
  budgetMs: number;
  deps: SkillIndexServiceDeps;
  sourceControlRepositoryId: number;
}): Promise<{ status: "failed" | "fresh" | "missing" | "stale" }> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  timeoutId = setTimeout(() => {
    controller.abort();
  }, input.budgetMs);
  try {
    return await refreshSkillIndexSource({
      deps: input.deps,
      reason: "read",
      signal: controller.signal,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function deriveReadStatus(input: {
  entries: SkillIndexEntry[];
  refreshStatus: "failed" | "fresh" | "missing" | "stale";
  state: {
    indexedCommitSha: string | null;
    lastCheckedCommitSha: string | null;
    lastRefreshStatus: string;
  } | null;
}): SkillIndexFreshness["status"] {
  if (
    input.state?.indexedCommitSha &&
    input.state.lastCheckedCommitSha &&
    input.state.indexedCommitSha === input.state.lastCheckedCommitSha
  ) {
    return "fresh";
  }
  if (
    input.refreshStatus === "stale" &&
    input.state?.lastRefreshStatus === "refreshing"
  ) {
    return "refreshing";
  }
  return input.entries.length > 0 ? "stale" : "unavailable";
}

async function readConsistentSnapshot(
  deps: SkillIndexServiceDeps,
  input: {
    initialState: SkillIndexState;
    slug?: string;
    sourceControlRepositoryId: number;
  }
): Promise<{
  entries: SkillIndexEntry[];
  snapshotVersion: string | null;
  state: SkillIndexState | null;
}> {
  let state = input.initialState;

  for (let attempt = 0; attempt < SNAPSHOT_READ_MAX_ATTEMPTS; attempt++) {
    const snapshotVersion = toSkillIndexSnapshotVersion(state);
    const entries = await readEntries(deps, {
      slug: input.slug,
      stateId: state.id,
    });
    const latestState =
      await deps.getSkillIndexStateBySourceControlRepositoryId(deps.db, {
        sourceControlRepositoryId: input.sourceControlRepositoryId,
      });

    if (!latestState) {
      return { entries: [], snapshotVersion: null, state: null };
    }

    const latestSnapshotVersion = toSkillIndexSnapshotVersion(latestState);
    if (latestSnapshotVersion === snapshotVersion) {
      return {
        entries,
        snapshotVersion: latestSnapshotVersion,
        state: latestState,
      };
    }

    state = latestState;
  }

  return { entries: [], snapshotVersion: null, state: null };
}

function deriveSnapshotStatus(state: {
  indexedCommitSha: string | null;
  lastCheckedCommitSha: string | null;
  lastRefreshStatus: string;
}): SkillIndexFreshness["status"] {
  if (
    state.indexedCommitSha &&
    state.lastCheckedCommitSha &&
    state.indexedCommitSha === state.lastCheckedCommitSha
  ) {
    return "fresh";
  }
  if (state.lastRefreshStatus === "refreshing") {
    return "refreshing";
  }
  return state.indexedCommitSha ? "stale" : "unavailable";
}

function toSkillIndexSnapshotVersion(state: {
  id: number;
  indexedCommitSha: string | null;
  lastRefreshStatus: string;
  updatedAt: Date;
}): string {
  return [
    state.id,
    state.updatedAt.getTime(),
    state.indexedCommitSha ?? "",
    state.lastRefreshStatus,
  ].join(":");
}

function toFreshness(
  state: {
    indexedAt: Date | null;
    indexedCommitSha: string | null;
    lastCheckedAt: Date | null;
    lastCheckedCommitSha: string | null;
    lastRefreshErrorCode: string | null;
    lastRefreshErrorMessage: string | null;
  } | null,
  status: SkillIndexFreshness["status"]
): SkillIndexFreshness {
  return {
    checkedAt: state?.lastCheckedAt ?? null,
    errorCode: state?.lastRefreshErrorCode ?? null,
    errorMessage: state?.lastRefreshErrorMessage ?? null,
    githubCommitSha: state?.lastCheckedCommitSha ?? null,
    indexedAt: state?.indexedAt ?? null,
    indexedCommitSha: state?.indexedCommitSha ?? null,
    status,
  };
}

async function readEntries(
  deps: SkillIndexServiceDeps,
  input: { slug?: string; stateId: number }
): Promise<SkillIndexEntry[]> {
  if (!input.slug) {
    return await deps.listSkillIndexEntries(deps.db, {
      stateId: input.stateId,
    });
  }

  const entry = await deps.getSkillIndexEntryBySlug(deps.db, {
    slug: input.slug,
    stateId: input.stateId,
  });
  return entry ? [entry] : [];
}

function getRepositoryUrl(fullName: string): string {
  try {
    return buildGitHubRepositoryUrl({
      fullName,
      webBaseUrl: getGitHubAppConfig().endpoints.webBaseUrl,
    });
  } catch {
    // Tests and local callers can inject all data deps without GitHub env.
    return buildGitHubRepositoryUrl({ fullName });
  }
}
