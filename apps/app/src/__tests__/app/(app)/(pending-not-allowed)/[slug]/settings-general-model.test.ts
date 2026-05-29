import { describe, expect, it } from "vitest";

import {
  normalizeTeamSlugInput,
  renameOrganizationSlug,
} from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-model";

describe("team general settings model", () => {
  it("normalizes team slug input once before form state updates", () => {
    expect(normalizeTeamSlugInput("--Acme Inc!--")).toBe("acmeinc");
    expect(normalizeTeamSlugInput("team---alpha")).toBe("team---alpha");
  });

  it("renames the matching organization in an optimistic cache snapshot", () => {
    expect(
      renameOrganizationSlug(
        [
          { id: "org_1", initials: "A", slug: "acme" },
          { id: "org_2", initials: "B", slug: "beta" },
        ],
        {
          name: "acme-next",
          slug: "acme",
        }
      )
    ).toEqual([
      { id: "org_1", initials: "A", slug: "acme-next" },
      { id: "org_2", initials: "B", slug: "beta" },
    ]);
  });
});
