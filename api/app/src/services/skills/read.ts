import type { SkillIndexEntry } from "@db/app";
import type { SkillDiagnostic } from "@repo/skills-contract";

import { getGitHubAppConfig } from "../github/config";
import { resolveSkillIndexServiceDeps } from "./deps";
import {
  checkSkillIndexCandidateRef,
  refreshSkillIndexSource,
} from "./refresh";
import { getVerifiedCandidateByRepositoryId } from "./repository";
import type { SkillIndexFreshness, SkillIndexServiceDeps } from "./types";

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
  const repositoryUrl = candidate
    ? getRepositoryUrl(candidate.repository.fullName)
    : "";
  let state =
    candidate?.state ??
    (await deps.getSkillIndexStateBySourceControlRepositoryId(deps.db, {
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    }));
  if (!candidate) {
    return {
      freshness: toFreshness(state, "unavailable"),
      indexDiagnostics: [],
      repositoryUrl,
      skills: [],
    };
  }

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
  let webBaseUrl = "https://github.com";
  try {
    webBaseUrl = getGitHubAppConfig().endpoints.webBaseUrl;
  } catch {
    // Tests and local callers can inject all data deps without GitHub env.
  }
  return new URL(fullName, `${webBaseUrl}/`).toString();
}
