import type { ListSkillsResult } from "@api/app/tanstack/skills";

export type SkillsListResult = ListSkillsResult;
export type Skill = SkillsListResult["skills"][number];
export type SkillsFreshness = SkillsListResult["freshness"];
