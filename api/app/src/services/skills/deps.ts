import { randomUUID } from "node:crypto";
import {
  acquireSkillIndexRefreshLock,
  createOrLoadSkillIndexState,
  db,
  getSkillIndexableSourceControlRepositoryCandidateById,
  getSkillIndexEntryBySlug,
  getSkillIndexStateBySourceControlRepositoryId,
  listSkillIndexableSourceControlRepositoryCandidates,
  listSkillIndexEntries,
  markSkillIndexRefreshFailed,
  markSkillIndexRefreshFresh,
  markSkillIndexRefreshStale,
  releaseSkillIndexRefreshLock,
  replaceSkillIndexEntries,
  updateSkillIndexRefCheck,
} from "@db/app";
import { redis } from "@vendor/upstash";

import {
  readSkillRepositoryBlob,
  readSkillRepositoryMainRef,
  readSkillRepositoryTree,
} from "./github";
import { enqueueSkillIndexRefresh } from "./refresh-request";
import type { SkillIndexChangedEvent, SkillIndexServiceDeps } from "./types";

export function resolveSkillIndexServiceDeps(
  deps?: Partial<SkillIndexServiceDeps>
): SkillIndexServiceDeps {
  return {
    ...defaultSkillIndexServiceDeps,
    ...deps,
  };
}

async function publishSkillIndexChanged(event: SkillIndexChangedEvent) {
  await redis.publish(
    `lightfast:org:${event.clerkOrgId}:skills:index`,
    JSON.stringify({
      type: "skill_index.changed",
      ...event,
      occurredAt: new Date().toISOString(),
    })
  );
}

const defaultSkillIndexServiceDeps: SkillIndexServiceDeps = {
  acquireSkillIndexRefreshLock,
  createOrLoadSkillIndexState,
  db,
  enqueueRefresh: enqueueSkillIndexRefresh,
  getSkillIndexStateBySourceControlRepositoryId,
  getSkillIndexableSourceControlRepositoryCandidateById,
  getSkillIndexEntryBySlug,
  listSkillIndexableSourceControlRepositoryCandidates,
  listSkillIndexEntries,
  markSkillIndexRefreshFresh,
  markSkillIndexRefreshFailed,
  markSkillIndexRefreshStale,
  now: () => new Date(),
  publishSkillIndexChanged,
  randomToken: () => randomUUID(),
  readSkillRepositoryBlob,
  readSkillRepositoryMainRef,
  readSkillRepositoryTree,
  releaseSkillIndexRefreshLock,
  replaceSkillIndexEntries,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  updateSkillIndexRefCheck,
};
