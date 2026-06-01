import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "skills", "list"],
}));

let listData = createListData({
  skills: [createSkill({ slug: "code-review" })],
});

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        skills: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({ data: listData }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "acme" }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children?: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-markdown",
  () => ({
    SkillMarkdown: () => <div>Markdown preview</div>,
    getSkillSourceUrl: () =>
      "https://github.com/acme/.lightfast/blob/main/skills/code-review/SKILL.md",
  })
);

const { SkillsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-client"
);

beforeEach(() => {
  listData = createListData({
    skills: [createSkill({ slug: "code-review" })],
  });
  listQueryOptionsMock.mockClear();
});

describe("SkillsClient", () => {
  it("labels search input and shows a filtered empty state", () => {
    render(<SkillsClient />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search skills" }), {
      target: { value: "does-not-match" },
    });

    expect(screen.getByText("No matching skills.")).toBeInTheDocument();
    expect(screen.queryByText("No skills indexed.")).not.toBeInTheDocument();
  });

  it("shows the indexed empty state only when the index has no skills", () => {
    listData = createListData({ skills: [] });

    render(<SkillsClient />);

    expect(screen.getByText("No skills indexed.")).toBeInTheDocument();
  });
});

function createListData(input: { skills: ReturnType<typeof createSkill>[] }) {
  return {
    freshness: {
      checkedAt: new Date("2026-06-01T00:00:00.000Z"),
      errorCode: null,
      errorMessage: null,
      githubCommitSha: "a".repeat(40),
      indexedAt: new Date("2026-06-01T00:00:00.000Z"),
      indexedCommitSha: "a".repeat(40),
      status: "fresh" as const,
    },
    indexDiagnostics: [],
    repositoryUrl: "https://github.com/acme/.lightfast",
    skills: input.skills,
  };
}

function createSkill(overrides: Partial<ReturnType<typeof baseSkill>> = {}) {
  return {
    ...baseSkill(),
    ...overrides,
  };
}

function baseSkill() {
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
    resourcesTruncated: 0 as const,
    skillIndexStateId: 1,
    slug: "code-review",
    sourceMarkdown: "---\nname: code-review\n---\nBody",
    updatedAt: now,
    validationStatus: "valid" as const,
  };
}
