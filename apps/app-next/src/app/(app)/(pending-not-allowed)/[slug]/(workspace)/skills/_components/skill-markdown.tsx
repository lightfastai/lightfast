import type { AppRouterOutputs } from "@api/app";
import { MarkdownContent } from "@repo/ui/components/markdown-content";

type SkillsListResult = AppRouterOutputs["org"]["workspace"]["skills"]["list"];
type Skill = SkillsListResult["skills"][number];

export function SkillMarkdown({
  repositoryUrl,
  skill,
}: {
  repositoryUrl: string;
  skill: Skill;
}) {
  const markdown = skill.bodyMarkdown ?? skill.sourceMarkdown;

  if (!markdown) {
    return (
      <p className="text-muted-foreground text-sm">
        Markdown preview unavailable.
      </p>
    );
  }

  return (
    <MarkdownContent
      className="prose-sm max-w-none"
      sourcePath={skill.path}
      sourceUrlBase={getSkillSourceUrlBase({ repositoryUrl, skill })}
    >
      {markdown}
    </MarkdownContent>
  );
}

export function getSkillSourceUrl(input: {
  repositoryUrl: string;
  skill: Pick<Skill, "indexedCommitSha" | "path">;
}) {
  return getRepositoryBlobUrl({
    commitSha: input.skill.indexedCommitSha,
    path: input.skill.path,
    repositoryUrl: input.repositoryUrl,
  });
}

export function getRepositoryBlobUrl(input: {
  commitSha: string;
  path: string;
  repositoryUrl: string;
}) {
  if (!input.repositoryUrl) {
    return "";
  }

  return `${input.repositoryUrl.replace(/\/+$/, "")}/blob/${input.commitSha}/${encodeRepositoryPath(input.path)}`;
}

function getSkillSourceUrlBase(input: {
  repositoryUrl: string;
  skill: Pick<Skill, "indexedCommitSha" | "path">;
}) {
  const sourceUrl = getSkillSourceUrl(input);
  if (!sourceUrl) {
    return "";
  }

  return sourceUrl.split("/").slice(0, -1).join("/");
}

function encodeRepositoryPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
