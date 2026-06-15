"use client";

import type { ReactNode } from "react";
import { SkillCell } from "./skill-cell";
import type { Skill } from "./skills-types";

export function SkillGrid({
  emptyState,
  onSelect,
  skills,
}: {
  emptyState: ReactNode;
  onSelect: (slug: string) => void;
  skills: Skill[];
}) {
  return (
    <section className="mt-9">
      <div className="flex items-center gap-2 border-border border-b pb-2.5">
        <span className="font-medium text-foreground text-sm">Team</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
          {skills.length}
        </span>
      </div>
      {skills.length === 0 ? (
        <div className="py-10 text-muted-foreground text-sm">{emptyState}</div>
      ) : (
        <div className="mt-1 grid grid-cols-1 gap-x-2 sm:grid-cols-2">
          {skills.map((skill) => (
            <SkillCell key={skill.slug} onSelect={onSelect} skill={skill} />
          ))}
        </div>
      )}
    </section>
  );
}
