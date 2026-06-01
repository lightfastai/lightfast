import {
  acquireSkillIndexRefreshLock,
  createOrLoadSkillIndexState,
  db,
  getSkillIndexStateBySourceControlRepositoryId,
  getSkillIndexableSourceControlRepositoryCandidateById,
  listSkillIndexableSourceControlRepositoryCandidates,
  listSkillIndexEntries,
  markSkillIndexRefreshFailed,
  releaseSkillIndexRefreshLock,
  replaceSkillIndexEntries,
  updateSkillIndexRefCheck,
} from "@db/app";
import { randomUUID } from "node:crypto";

import {
  readSkillRepositoryBlob,
  readSkillRepositoryMainRef,
  readSkillRepositoryTree,
} from "./github";
import type { SkillIndexServiceDeps } from "./types";

export function resolveSkillIndexServiceDeps(
  deps?: SkillIndexServiceDeps
): SkillIndexServiceDeps {
  return deps ?? defaultSkillIndexServiceDeps;
}

const defaultSkillIndexServiceDeps: SkillIndexServiceDeps = {
  acquireSkillIndexRefreshLock,
  createOrLoadSkillIndexState,
  db,
  enqueueRefresh: async () => undefined,
  getSkillIndexStateBySourceControlRepositoryId,
  getSkillIndexableSourceControlRepositoryCandidateById,
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
