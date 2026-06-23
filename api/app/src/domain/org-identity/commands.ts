import type {
  Database,
  getIdentityIndexStateBySourceControlRepositoryId,
  IdentityIndexFile,
  IdentityIndexState,
  listIdentityIndexFiles,
  listIdentityIndexRefreshCandidates,
  SourceControlRepository,
} from "@db/app";
import { z } from "zod";

import { defineCommand } from "../command";
import { requireBoundClerkOrgActor } from "../gates";

const IDENTITY_FILES = [
  {
    kind: "identity" as const,
    label: "Identity" as const,
    path: "IDENTITY.md" as const,
  },
  { kind: "soul" as const, label: "Soul" as const, path: "SOUL.md" as const },
];

const DEFAULT_IDENTITY_BRANCH = "main" as const;

interface IdentityRefreshCandidate {
  binding: {
    providerInstallationId: string | null;
  };
  repository: SourceControlRepository;
  state?: IdentityIndexState | null;
}

export interface OrgIdentityCommandDeps {
  db: Database;
  getIdentityIndexStateBySourceControlRepositoryId: typeof getIdentityIndexStateBySourceControlRepositoryId;
  isVerifiedLightfastIdentityRepository(input: {
    binding: IdentityRefreshCandidate["binding"];
    repository: SourceControlRepository;
  }): boolean;
  listIdentityIndexFiles: typeof listIdentityIndexFiles;
  listIdentityIndexRefreshCandidates: typeof listIdentityIndexRefreshCandidates;
  readIdentityRepositoryMainRef(input: {
    fullName: string;
    installationId: string;
  }): Promise<{ defaultBranch?: string | null; status: string }>;
  requestIdentityRefresh: (sourceControlRepositoryId: number) => Promise<void>;
}

const orgIdentityInput = z.object({}).strict();

const identityFileOutput = z.object({
  contentHash: z.string().nullable(),
  contentSha: z.string().nullable(),
  diagnostics: z.array(z.string()),
  githubUrl: z.string().url(),
  indexedCommitSha: z.string().nullable(),
  kind: z.enum(["identity", "soul"]),
  label: z.enum(["Identity", "Soul"]),
  path: z.enum(["IDENTITY.md", "SOUL.md"]),
  size: z.number().int().nonnegative().nullable(),
  sourceMarkdown: z.string().nullable(),
  status: z.enum(["present", "missing", "read_error", "too_large"]),
});

const orgIdentityOutput = z.discriminatedUnion("configured", [
  z.object({ configured: z.literal(false) }),
  z.object({
    configured: z.literal(true),
    files: z.array(identityFileOutput),
    repository: z.object({
      defaultBranch: z.string().min(1),
      id: z.string().min(1),
      name: z.string(),
      owner: z.string(),
    }),
    state: z.object({
      diagnostics: z.array(z.string()),
      indexedCommitSha: z.string().nullable(),
      indexedTreeSha: z.string().nullable(),
      lastCheckedAt: z.date().nullable(),
      lastFailureAt: z.date().nullable(),
      lastSuccessAt: z.date().nullable(),
      status: z.string(),
    }),
  }),
]);

function repositoryResponse(
  repository: SourceControlRepository,
  defaultBranch: string
) {
  const [owner = "", name = ""] = repository.fullName.split("/");
  return {
    defaultBranch,
    id: String(repository.id),
    name,
    owner,
  };
}

async function getIdentityRepositoryDefaultBranch(
  deps: OrgIdentityCommandDeps,
  candidate: IdentityRefreshCandidate
): Promise<string> {
  if (!candidate.binding.providerInstallationId) {
    return DEFAULT_IDENTITY_BRANCH;
  }

  try {
    const ref = await deps.readIdentityRepositoryMainRef({
      fullName: candidate.repository.fullName,
      installationId: candidate.binding.providerInstallationId,
    });
    return ref.status === "found"
      ? (ref.defaultBranch ?? DEFAULT_IDENTITY_BRANCH)
      : DEFAULT_IDENTITY_BRANCH;
  } catch {
    return DEFAULT_IDENTITY_BRANCH;
  }
}

function stateResponse(state: IdentityIndexState | null) {
  return {
    diagnostics: state?.indexDiagnostics ?? [],
    indexedCommitSha: state?.indexedCommitSha ?? null,
    indexedTreeSha: state?.indexedTreeSha ?? null,
    lastCheckedAt: state?.lastCheckedAt ?? null,
    lastFailureAt: state?.lastRefreshFailedAt ?? null,
    lastSuccessAt: state?.lastRefreshSucceededAt ?? null,
    status: state?.lastRefreshStatus ?? "never",
  };
}

function fileResponse(input: {
  defaultBranch: string;
  file: IdentityIndexFile | undefined;
  fullName: string;
  target: (typeof IDENTITY_FILES)[number];
}) {
  const file = input.file;
  return {
    contentHash: file?.contentHash ?? null,
    contentSha: file?.contentSha ?? null,
    diagnostics: file?.diagnostics ?? [`${input.target.path} is missing.`],
    githubUrl: `https://github.com/${input.fullName}/blob/${input.defaultBranch}/${input.target.path}`,
    indexedCommitSha: file?.indexedCommitSha ?? null,
    kind: input.target.kind,
    label: input.target.label,
    path: input.target.path,
    size: file?.contentSize ?? null,
    sourceMarkdown: file?.sourceMarkdown ?? null,
    status: file?.status ?? "missing",
  };
}

function shouldEnqueueRefresh(state: IdentityIndexState | null): boolean {
  return (
    !state?.indexedCommitSha ||
    state.lastRefreshStatus === "failed" ||
    state.lastRefreshStatus === "never" ||
    state.lastRefreshStatus === "stale"
  );
}

export const getOrgIdentityCommand = defineCommand<
  "orgIdentity.get",
  typeof orgIdentityInput,
  typeof orgIdentityOutput,
  OrgIdentityCommandDeps
>({
  name: "orgIdentity.get",
  input: orgIdentityInput,
  output: orgIdentityOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireBoundClerkOrgActor(ctx);
    const candidates = await deps.listIdentityIndexRefreshCandidates(deps.db, {
      clerkOrgId: actor.orgId,
      limit: 100,
    });
    const candidate = candidates.find((row) =>
      deps.isVerifiedLightfastIdentityRepository(row)
    ) as IdentityRefreshCandidate | undefined;

    if (!candidate) {
      return { configured: false as const };
    }

    const state =
      candidate.state ??
      (await deps.getIdentityIndexStateBySourceControlRepositoryId(deps.db, {
        sourceControlRepositoryId: candidate.repository.id,
      }));

    if (shouldEnqueueRefresh(state)) {
      await deps.requestIdentityRefresh(candidate.repository.id);
    }

    const defaultBranch = await getIdentityRepositoryDefaultBranch(
      deps,
      candidate
    );
    const files = state
      ? await deps.listIdentityIndexFiles(deps.db, { stateId: state.id })
      : [];

    return {
      configured: true as const,
      files: IDENTITY_FILES.map((target) =>
        fileResponse({
          defaultBranch,
          file: files.find((item) => item.kind === target.kind),
          fullName: candidate.repository.fullName,
          target,
        })
      ),
      repository: repositoryResponse(candidate.repository, defaultBranch),
      state: stateResponse(state),
    };
  },
});
