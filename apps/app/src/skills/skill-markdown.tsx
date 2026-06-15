import { MarkdownContent } from "@repo/ui/components/markdown-content";
import { getSkillSourceUrl, getSkillSourceUrlBase } from "./skills-model";
import type { Skill } from "./skills-types";

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

export { getSkillSourceUrl };
