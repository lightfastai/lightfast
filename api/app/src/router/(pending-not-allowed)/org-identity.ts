import {
  getIdentityIndexStateBySourceControlRepositoryId,
  type IdentityIndexFile,
  type IdentityIndexState,
  listIdentityIndexFiles,
  listIdentityIndexRefreshCandidates,
  type SourceControlRepository,
} from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import { createIdentityRefreshDedupeKey } from "../../inngest/workflow/identity-refresh-event";
import { isVerifiedLightfastIdentityRepository } from "../../services/identity/eligibility";
import { boundOrgProcedure } from "../../trpc";

interface IdentityFileResponse {
  contentHash: string | null;
  contentSha: string | null;
  diagnostics: string[];
  githubUrl: string;
  indexedCommitSha: string | null;
  kind: "identity" | "soul";
  label: "Identity" | "Soul";
  path: "IDENTITY.md" | "SOUL.md";
  size: number | null;
  sourceMarkdown: string | null;
  status: "present" | "missing" | "read_error" | "too_large";
}

const IDENTITY_FILES = [
  {
    kind: "identity" as const,
    label: "Identity" as const,
    path: "IDENTITY.md" as const,
  },
  { kind: "soul" as const, label: "Soul" as const, path: "SOUL.md" as const },
];

export const orgIdentityRouter = {
  get: boundOrgProcedure.query(async ({ ctx }) => {
    const candidates = await listIdentityIndexRefreshCandidates(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      limit: 100,
    });
    const candidate = candidates.find((row) =>
      isVerifiedLightfastIdentityRepository(row)
    );
    if (!candidate) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No verified Lightfast identity repository is configured.",
      });
    }

    const state =
      candidate.state ??
      (await getIdentityIndexStateBySourceControlRepositoryId(ctx.db, {
        sourceControlRepositoryId: candidate.repository.id,
      }));

    if (shouldEnqueueRefresh(state)) {
      await enqueueIdentityRefresh(candidate.repository.id);
    }

    const files = state
      ? await listIdentityIndexFiles(ctx.db, { stateId: state.id })
      : [];

    return {
      repository: repositoryResponse(candidate.repository),
      state: stateResponse(state),
      files: IDENTITY_FILES.map((target) =>
        fileResponse({
          file: files.find((item) => item.kind === target.kind),
          fullName: candidate.repository.fullName,
          target,
        })
      ),
    };
  }),
} satisfies TRPCRouterRecord;

function repositoryResponse(repository: SourceControlRepository) {
  const [owner = "", name = ""] = repository.fullName.split("/");
  return {
    defaultBranch: "main" as const,
    id: String(repository.id),
    name,
    owner,
  };
}

function stateResponse(state: IdentityIndexState | null) {
  return {
    diagnostics: state?.indexDiagnostics ?? [],
    indexedCommitSha: state?.indexedCommitSha ?? null,
    indexedTreeSha: state?.indexedTreeSha ?? null,
    lastCheckedAt: state?.lastCheckedAt ?? null,
    lastFailureAt: state?.lastRefreshFailedAt ?? null,
    lastSuccessAt: state?.lastRefreshSucceededAt ?? null,
    status: state?.lastRefreshStatus ?? ("never" as const),
  };
}

function fileResponse(input: {
  file: IdentityIndexFile | undefined;
  fullName: string;
  target: (typeof IDENTITY_FILES)[number];
}): IdentityFileResponse {
  const file = input.file;
  return {
    contentHash: file?.contentHash ?? null,
    contentSha: file?.contentSha ?? null,
    diagnostics: file?.diagnostics ?? [`${input.target.path} is missing.`],
    githubUrl: `https://github.com/${input.fullName}/blob/main/${input.target.path}`,
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

async function enqueueIdentityRefresh(sourceControlRepositoryId: number) {
  try {
    const { inngest } = await import("../../inngest/client");
    await inngest.send({
      name: "app/identity.index.refresh.requested",
      data: {
        dedupeKey: createIdentityRefreshDedupeKey({
          reason: "read",
          sourceControlRepositoryId,
        }),
        reason: "read",
        sourceControlRepositoryId,
      },
    });
  } catch {
    return;
  }
}
