import { SkillGlyph } from "./skill-glyph";
import type { Skill } from "./skills-types";

export function SkillCell({
  onSelect,
  skill,
}: {
  onSelect: (slug: string) => void;
  skill: Skill;
}) {
  const isInvalid = skill.validationStatus === "invalid";

  return (
    <button
      className="flex w-full items-center gap-3 rounded-[9px] px-2.5 py-3 text-left hover:bg-muted/50"
      onClick={() => onSelect(skill.slug)}
      type="button"
    >
      <SkillGlyph />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground text-sm">
          {skill.name ?? skill.slug}
        </span>
        {skill.description && (
          <span className="mt-0.5 block truncate text-muted-foreground text-xs">
            {skill.description}
          </span>
        )}
      </span>
      {isInvalid && (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/35 px-2 py-0.5 text-amber-500 text-xs">
          <span className="size-1.5 rounded-full bg-amber-500" />
          Invalid
        </span>
      )}
    </button>
  );
}
