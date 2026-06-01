import type {
  Database,
  ReplaceSkillIndexEntriesInput,
  ReplaceSkillIndexEntryInput,
  SkillIndexableSourceControlRepositoryCandidate,
  SkillIndexEntry,
  SkillIndexState,
} from "@db/app";
import type { SkillDiagnostic, SkillTreeEntry } from "@repo/skills-contract";

export type SkillRepositoryMainRef =
  | { etag: string | null; sha: string; status: "found" }
  | { status: "missing" }
  | { status: "not_modified" };

export interface SkillRepositoryCommit {
  sha: string;
  treeSha: string;
}

export interface SkillRepositoryTree {
  sha: string;
  tree: SkillTreeEntry[];
  truncated?: boolean;
}

export interface SkillRepositoryBlob {
  sha: string;
  size: number;
  text: string;
}

export interface BuiltSkillIndex {
  entries: ReplaceSkillIndexEntryInput[];
  indexDiagnostics: SkillDiagnostic[];
}

export interface SkillIndexFreshness {
  checkedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  githubCommitSha: string | null;
  indexedAt: Date | null;
  indexedCommitSha: string | null;
  status: "fresh" | "refreshing" | "stale" | "unavailable";
}

export interface SkillIndexServiceDeps {
  acquireSkillIndexRefreshLock: (
    db: Database,
    input: { lockToken: string; now: Date; stateId: number; ttlSeconds: number }
  ) => Promise<boolean>;
  createOrLoadSkillIndexState: (
    db: Database,
    input: { sourceControlRepositoryId: number }
  ) => Promise<SkillIndexState>;
  db: Database;
  enqueueRefresh?: (input: {
    reason: "schedule";
    sourceControlRepositoryId: number;
    targetCommitSha?: string;
  }) => Promise<void>;
  getSkillIndexStateBySourceControlRepositoryId: (
    db: Database,
    input: { sourceControlRepositoryId: number }
  ) => Promise<SkillIndexState | null>;
  listSkillIndexableSourceControlRepositoryCandidates: (
    db: Database,
    input: { clerkOrgId?: string; limit: number }
  ) => Promise<SkillIndexableSourceControlRepositoryCandidate[]>;
  listSkillIndexEntries: (
    db: Database,
    input: { stateId: number }
  ) => Promise<SkillIndexEntry[]>;
  markSkillIndexRefreshFailed: (
    db: Database,
    input: {
      errorCode: string;
      errorMessage: string;
      failedAt: Date;
      lockToken: string;
      stateId: number;
    }
  ) => Promise<void>;
  now: () => Date;
  randomToken: () => string;
  readSkillRepositoryBlob: (input: {
    fullName: string;
    installationId: string;
    sha: string;
    signal?: AbortSignal;
  }) => Promise<SkillRepositoryBlob>;
  readSkillRepositoryMainRef: (input: {
    etag?: string | null;
    fullName: string;
    installationId: string;
    signal?: AbortSignal;
  }) => Promise<SkillRepositoryMainRef>;
  readSkillRepositoryTree: (input: {
    commitSha: string;
    fullName: string;
    installationId: string;
    signal?: AbortSignal;
  }) => Promise<{ commit: SkillRepositoryCommit; tree: SkillRepositoryTree }>;
  releaseSkillIndexRefreshLock: (
    db: Database,
    input: { lockToken: string; stateId: number }
  ) => Promise<number>;
  replaceSkillIndexEntries: (
    db: Database,
    input: ReplaceSkillIndexEntriesInput
  ) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  updateSkillIndexRefCheck: (
    db: Database,
    input: {
      githubRefEtag: string | null;
      lastCheckedAt: Date;
      lastCheckedCommitSha: string | null;
      sourceControlRepositoryId: number;
    }
  ) => Promise<number>;
}
