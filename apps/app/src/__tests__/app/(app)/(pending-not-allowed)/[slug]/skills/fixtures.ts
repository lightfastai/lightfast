import type { AppRouterOutputs } from "@api/app";

type SkillsListResult = AppRouterOutputs["org"]["workspace"]["skills"]["list"];
export type Skill = SkillsListResult["skills"][number];

export function createSkill(overrides: Partial<Skill> = {}): Skill {
  const now = new Date("2026-06-01T00:00:00.000Z");
  return {
    allowedTools: null,
    bodyMarkdown: "Body",
    compatibility: null,
    contentSha: "content-sha",
    contentSize: 100,
    createdAt: now,
    description: "Review code changes",
    diagnostics: [],
    id: 1,
    indexedCommitSha: "a".repeat(40),
    license: null,
    metadata: {},
    name: "code-review",
    nonStandardResourceCount: 0,
    path: "skills/code-review/SKILL.md",
    resources: { assets: [], references: [], scripts: [], truncated: false },
    resourcesTruncated: 0,
    skillIndexStateId: 1,
    slug: "code-review",
    sourceMarkdown: "---\nname: code-review\n---\nBody",
    updatedAt: now,
    validationStatus: "valid",
    ...overrides,
  };
}

export function createListData(
  input: {
    indexDiagnostics?: SkillsListResult["indexDiagnostics"];
    repositoryUrl?: string;
    skills?: Skill[];
  } = {}
): SkillsListResult {
  return {
    freshness: {
      checkedAt: new Date("2026-06-01T00:00:00.000Z"),
      errorCode: null,
      errorMessage: null,
      githubCommitSha: "a".repeat(40),
      indexedAt: new Date("2026-06-01T00:00:00.000Z"),
      indexedCommitSha: "a".repeat(40),
      status: "fresh",
    },
    indexDiagnostics: input.indexDiagnostics ?? [],
    repositoryUrl: input.repositoryUrl ?? "https://github.com/acme/.lightfast",
    skills: input.skills ?? [createSkill()],
  };
}
