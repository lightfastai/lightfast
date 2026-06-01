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
      className="text-sm"
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
  if (!input.repositoryUrl) {
    return "";
  }

  return `${input.repositoryUrl.replace(/\/+$/, "")}/blob/${input.skill.indexedCommitSha}/${input.skill.path}`;
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
