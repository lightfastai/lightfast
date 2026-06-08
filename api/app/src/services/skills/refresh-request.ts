import { createSkillRefreshDedupeKey } from "../../inngest/workflow/skill-refresh-event";
import { resolveSkillIndexServiceDeps } from "./deps";
import { getVerifiedCandidateByRepositoryId } from "./repository";
import type { SkillIndexServiceDeps } from "./types";

export async function enqueueSkillIndexRefresh(input: {
  reason: "read" | "schedule" | "setup" | "webhook";
  sourceControlRepositoryId: number;
  targetCommitSha?: string;
}): Promise<void> {
  const { inngest } = await import("../../inngest/client");
  await inngest.send({
    name: "app/skills.index.refresh.requested",
    data: {
      dedupeKey: createSkillRefreshDedupeKey(input),
      reason: input.reason,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
      targetCommitSha: input.targetCommitSha,
    },
  });
}

export async function requestSkillIndexRefresh(input: {
  clerkOrgId?: string;
  deps?: Partial<SkillIndexServiceDeps>;
  reason: "read" | "schedule" | "setup" | "webhook";
  sourceControlRepositoryId: number;
  targetCommitSha?: string;
}): Promise<{
  enqueued: boolean;
  sourceControlRepositoryId: number;
}> {
  const deps = resolveSkillIndexServiceDeps(input.deps);
  if (!input.clerkOrgId) {
    return {
      enqueued: false,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    };
  }

  const candidate = await getVerifiedCandidateByRepositoryId(deps, {
    clerkOrgId: input.clerkOrgId,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });

  if (!candidate) {
    return {
      enqueued: false,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    };
  }

  const enqueue = deps.enqueueRefresh ?? enqueueSkillIndexRefresh;
  try {
    await enqueue({
      reason: input.reason,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
      targetCommitSha: input.targetCommitSha,
    });
  } catch (error) {
    if (input.reason !== "read") {
      throw error;
    }

    return {
      enqueued: false,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    };
  }

  return {
    enqueued: true,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  };
}
