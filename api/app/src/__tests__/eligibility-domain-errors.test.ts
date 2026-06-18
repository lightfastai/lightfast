import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  listIdentityIndexRefreshCandidates: vi.fn(),
  listSkillIndexableSourceControlRepositoryCandidates: vi.fn(),
}));

vi.mock("@db/app", () => ({
  listIdentityIndexRefreshCandidates:
    dbMocks.listIdentityIndexRefreshCandidates,
  listSkillIndexableSourceControlRepositoryCandidates:
    dbMocks.listSkillIndexableSourceControlRepositoryCandidates,
}));

const { getVerifiedLightfastIdentitySourceRepositoryId } = await import(
  "../services/identity/eligibility"
);
const { getVerifiedLightfastSkillSourceRepositoryId } = await import(
  "../services/skills/eligibility"
);

const apiRoot = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("repository eligibility domain errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws a domain conflict error when no skills repository is verified", async () => {
    dbMocks.listSkillIndexableSourceControlRepositoryCandidates.mockResolvedValueOnce(
      []
    );

    await expect(
      getVerifiedLightfastSkillSourceRepositoryId({} as Database, {
        clerkOrgId: "org_acme",
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "SKILLS_REPOSITORY_NOT_CONFIGURED",
        kind: "conflict",
      })
    );
  });

  it("throws a domain conflict error when no identity repository is verified", async () => {
    dbMocks.listIdentityIndexRefreshCandidates.mockResolvedValueOnce([]);

    await expect(
      getVerifiedLightfastIdentitySourceRepositoryId({} as Database, {
        clerkOrgId: "org_acme",
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "IDENTITY_REPOSITORY_NOT_CONFIGURED",
        kind: "conflict",
      })
    );
  });

  it("keeps eligibility errors framework-neutral", () => {
    for (const file of [
      "services/identity/eligibility.ts",
      "services/skills/eligibility.ts",
    ]) {
      const fileSource = source(file);

      expect(fileSource, file).toContain("../../domain/errors");
      expect(fileSource, file).not.toContain("@trpc/server");
      expect(fileSource, file).not.toContain("TRPCError");
    }
  });
});
