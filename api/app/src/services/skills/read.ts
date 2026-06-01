import { getGitHubAppConfig } from "../github/config";
import { resolveSkillIndexServiceDeps } from "./deps";
import { getVerifiedCandidateByRepositoryId } from "./repository";
import { refreshSkillIndexSource } from "./refresh";
import type {
  SkillIndexFreshness,
  SkillIndexServiceDeps,
} from "./types";

export async function ensureFreshSkillIndexForRead(input: {
  clerkOrgId: string;
  deps?: SkillIndexServiceDeps;
  sourceControlRepositoryId: number;
  slug?: string;
}): Promise<{
  freshness: SkillIndexFreshness;
  indexDiagnostics: unknown[];
  repositoryUrl: string;
  skills: unknown[];
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

  let entries = state
    ? await deps.listSkillIndexEntries(deps.db, { stateId: state.id })
    : [];
  if (
    state?.indexedCommitSha &&
    state.lastCheckedCommitSha &&
    state.indexedCommitSha === state.lastCheckedCommitSha
  ) {
    return {
      freshness: toFreshness(state, "fresh"),
      indexDiagnostics: state.indexDiagnostics,
      repositoryUrl,
      skills: filterEntries(entries, input.slug),
    };
  }

  const budgetMs = entries.length > 0 ? 3_000 : 10_000;
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
    entries = await deps.listSkillIndexEntries(deps.db, { stateId: state.id });
  }

  const status = deriveReadStatus({ entries, refreshStatus: refresh.status, state });
  return {
    freshness: toFreshness(state, status),
    indexDiagnostics: state?.indexDiagnostics ?? [],
    repositoryUrl,
    skills: filterEntries(entries, input.slug),
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
  entries: unknown[];
  refreshStatus: "failed" | "fresh" | "missing" | "stale";
  state: { indexedCommitSha: string | null; lastCheckedCommitSha: string | null; lastRefreshStatus: string } | null;
}): SkillIndexFreshness["status"] {
  if (
    input.state?.indexedCommitSha &&
    input.state.lastCheckedCommitSha &&
    input.state.indexedCommitSha === input.state.lastCheckedCommitSha
  ) {
    return "fresh";
  }
  if (input.refreshStatus === "stale" && input.state?.lastRefreshStatus === "refreshing") {
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

function filterEntries(entries: unknown[], slug?: string): unknown[] {
  if (!slug) {
    return entries;
  }
  return entries.filter(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "slug" in entry &&
      entry.slug === slug
  );
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
