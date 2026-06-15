import { describe, expect, it } from "vitest";
import { getRepositoryBlobUrl, getVisibleSkills } from "~/skills/skills-model";
import type { Skill } from "~/skills/skills-types";

describe("skills model", () => {
  it("filters skills by validation status and case-insensitive query", () => {
    const skills = [
      skill({
        description: "Review code changes",
        name: "Code Review",
        slug: "code-review",
      }),
      skill({
        description: "Plan release work",
        name: "Release Notes",
        path: "skills/release-notes/SKILL.md",
        slug: "release-notes",
        validationStatus: "invalid",
      }),
    ];

    expect(
      getVisibleSkills(skills, {
        query: " REVIEW ",
        validationStatus: "all",
      }).map((item) => item.slug)
    ).toEqual(["code-review"]);
    expect(
      getVisibleSkills(skills, {
        query: "skills/release",
        validationStatus: "invalid",
      }).map((item) => item.slug)
    ).toEqual(["release-notes"]);
    expect(
      getVisibleSkills(skills, { query: "", validationStatus: "valid" }).map(
        (item) => item.slug
      )
    ).toEqual(["code-review"]);
  });

  it("sorts invalid skills first, then slug, without mutating the input", () => {
    const skills = [
      skill({ slug: "zeta", validationStatus: "valid" }),
      skill({ slug: "alpha", validationStatus: "invalid" }),
      skill({ slug: "bravo", validationStatus: "invalid" }),
    ];

    expect(
      getVisibleSkills(skills, { query: "", validationStatus: "all" }).map(
        (item) => item.slug
      )
    ).toEqual(["alpha", "bravo", "zeta"]);
    expect(skills.map((item) => item.slug)).toEqual(["zeta", "alpha", "bravo"]);
  });

  it("encodes repository blob path segments", () => {
    expect(
      getRepositoryBlobUrl({
        commitSha: "abc123",
        path: "skills/code review/references/a#b.md",
        repositoryUrl: "https://github.com/acme/.lightfast/",
      })
    ).toBe(
      "https://github.com/acme/.lightfast/blob/abc123/skills/code%20review/references/a%23b.md"
    );
  });
});

function skill(overrides: Partial<Skill> = {}): Skill {
  const now = new Date("2026-06-01T00:00:00.000Z");
  return {
    allowedTools: null,
    bodyMarkdown: "Body",
    compatibility: null,
    contentSha: "content-sha",
    contentSize: 100,
    createdAt: now,
    description: "Reusable skill",
    diagnostics: [],
    id: 1,
    indexedCommitSha: "a".repeat(40),
    license: null,
    metadata: {},
    name: "demo",
    nonStandardResourceCount: 0,
    path: "skills/demo/SKILL.md",
    resources: { assets: [], references: [], scripts: [], truncated: false },
    resourcesTruncated: 0,
    skillIndexStateId: 1,
    slug: "demo",
    sourceMarkdown: "---\nname: demo\n---\nBody",
    updatedAt: now,
    validationStatus: "valid",
    ...overrides,
  };
}
