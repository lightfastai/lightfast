import { randomUUID } from "node:crypto";
import {
  acquireIdentityIndexRefreshLock,
  createOrLoadIdentityIndexState,
  db,
  getIdentityIndexRefreshCandidateById,
  getIdentityIndexStateBySourceControlRepositoryId,
  listIdentityIndexFiles,
  listIdentityIndexRefreshCandidates,
  markIdentityIndexRefreshFailed,
  releaseIdentityIndexRefreshLock,
  replaceIdentityIndexFiles,
  updateIdentityIndexRefCheck,
} from "@db/app";

import {
  readIdentityRepositoryBlob,
  readIdentityRepositoryMainRef,
  readIdentityRepositoryTree,
} from "./github";
import type { IdentityIndexServiceDeps } from "./types";

export function resolveIdentityIndexServiceDeps(
  deps?: Partial<IdentityIndexServiceDeps>
): IdentityIndexServiceDeps {
  return {
    ...defaultIdentityIndexServiceDeps,
    ...deps,
  };
}

const defaultIdentityIndexServiceDeps: IdentityIndexServiceDeps = {
  acquireIdentityIndexRefreshLock,
  createOrLoadIdentityIndexState,
  db,
  getIdentityIndexRefreshCandidateById,
  getIdentityIndexStateBySourceControlRepositoryId,
  listIdentityIndexFiles,
  listIdentityIndexRefreshCandidates,
  markIdentityIndexRefreshFailed,
  now: () => new Date(),
  randomToken: () => randomUUID(),
  readIdentityRepositoryBlob,
  readIdentityRepositoryMainRef,
  readIdentityRepositoryTree,
  releaseIdentityIndexRefreshLock,
  replaceIdentityIndexFiles,
  updateIdentityIndexRefCheck,
};
