import type { AppRouterOutputs } from "@api/app";

export type SkillsListResult =
  AppRouterOutputs["org"]["workspace"]["skills"]["list"];
export type Skill = SkillsListResult["skills"][number];
