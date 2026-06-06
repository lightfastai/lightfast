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
  releaseSkillIndexRefreshLock,
  replaceSkillIndexEntries,
  updateSkillIndexRefCheck,
} from "@db/app";

import {
  readSkillRepositoryBlob,
  readSkillRepositoryMainRef,
  readSkillRepositoryTree,
} from "./github";
import { enqueueSkillIndexRefresh } from "./refresh-request";
import type { SkillIndexServiceDeps } from "./types";

export function resolveSkillIndexServiceDeps(
  deps?: Partial<SkillIndexServiceDeps>
): SkillIndexServiceDeps {
  return {
    ...defaultSkillIndexServiceDeps,
    ...deps,
  };
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
  markSkillIndexRefreshFailed,
  now: () => new Date(),
  randomToken: () => randomUUID(),
  readSkillRepositoryBlob,
  readSkillRepositoryMainRef,
  readSkillRepositoryTree,
  releaseSkillIndexRefreshLock,
  replaceSkillIndexEntries,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  updateSkillIndexRefCheck,
};
