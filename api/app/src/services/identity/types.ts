import type {
  Database,
  IdentityIndexFile,
  IdentityIndexRefreshCandidate,
  IdentityIndexState,
  ReplaceIdentityIndexFileInput,
  ReplaceIdentityIndexFilesInput,
} from "@db/app";
import type {
  IdentityContextProvenance,
  IdentityContextSurface,
  IdentityFileKind,
} from "@repo/identity-contract";

export interface IdentityTreeEntry {
  mode: string;
  path: string;
  sha: string;
  size?: number;
  type: "blob" | "tree" | string;
}

export type IdentityRepositoryMainRef =
  | {
      defaultBranch?: string;
      etag: string | null;
      sha: string;
      status: "found";
    }
  | { status: "missing" }
  | { status: "not_modified" };

export interface IdentityRepositoryCommit {
  sha: string;
  treeSha: string;
}

export interface IdentityRepositoryTree {
  sha: string;
  tree: IdentityTreeEntry[];
  truncated?: boolean;
}

export interface IdentityRepositoryBlob {
  sha: string;
  size: number;
  text: string;
}

export interface BuiltIdentityIndex {
  files: ReplaceIdentityIndexFileInput[];
  indexDiagnostics: string[];
}

export interface IdentityContextSection {
  commitSha: string | null;
  contentHash: string | null;
  contentSha: string | null;
  kind: IdentityFileKind;
  path: string;
  sourceMarkdown: string;
  status: IdentityIndexFile["status"];
}

export interface OrgIdentityContext {
  provenance: IdentityContextProvenance;
  sections: IdentityContextSection[];
  state: IdentityIndexState | null;
  surface: IdentityContextSurface;
}

export interface IdentityIndexServiceDeps {
  acquireIdentityIndexRefreshLock: (
    db: Database,
    input: { lockToken: string; now: Date; stateId: number; ttlSeconds: number }
  ) => Promise<boolean>;
  createOrLoadIdentityIndexState: (
    db: Database,
    input: { sourceControlRepositoryId: number }
  ) => Promise<IdentityIndexState>;
  db: Database;
  enqueueRefresh?: (input: {
    reason: "read" | "schedule";
    sourceControlRepositoryId: number;
    targetCommitSha?: string;
  }) => Promise<void>;
  getIdentityIndexRefreshCandidateById: (
    db: Database,
    input: { clerkOrgId?: string; sourceControlRepositoryId: number }
  ) => Promise<IdentityIndexRefreshCandidate | null>;
  getIdentityIndexStateBySourceControlRepositoryId: (
    db: Database,
    input: { sourceControlRepositoryId: number }
  ) => Promise<IdentityIndexState | null>;
  listIdentityIndexFiles: (
    db: Database,
    input: { stateId: number }
  ) => Promise<IdentityIndexFile[]>;
  listIdentityIndexRefreshCandidates: (
    db: Database,
    input: { clerkOrgId?: string; limit: number }
  ) => Promise<IdentityIndexRefreshCandidate[]>;
  markIdentityIndexRefreshFailed: (
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
  readIdentityRepositoryBlob: (input: {
    fullName: string;
    installationId: string;
    sha: string;
    signal?: AbortSignal;
  }) => Promise<IdentityRepositoryBlob>;
  readIdentityRepositoryMainRef: (input: {
    etag?: string | null;
    fullName: string;
    installationId: string;
    signal?: AbortSignal;
  }) => Promise<IdentityRepositoryMainRef>;
  readIdentityRepositoryTree: (input: {
    commitSha: string;
    fullName: string;
    installationId: string;
    signal?: AbortSignal;
  }) => Promise<{
    commit: IdentityRepositoryCommit;
    tree: IdentityRepositoryTree;
  }>;
  releaseIdentityIndexRefreshLock: (
    db: Database,
    input: { lockToken: string; stateId: number }
  ) => Promise<number>;
  replaceIdentityIndexFiles: (
    db: Database,
    input: ReplaceIdentityIndexFilesInput
  ) => Promise<void>;
  updateIdentityIndexRefCheck: (
    db: Database,
    input: {
      githubRefEtag: string | null;
      lastCheckedAt: Date;
      lastCheckedCommitSha: string | null;
      sourceControlRepositoryId: number;
    }
  ) => Promise<number>;
}
