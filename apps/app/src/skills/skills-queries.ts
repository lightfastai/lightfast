import { type ListSkillsResult, listSkills } from "@api/app/tanstack/skills";
import { queryOptions } from "@tanstack/react-query";

export const skillsListQueryKey = ["skills", "list"] as const;

export function skillsListQueryOptions() {
  return queryOptions({
    enabled: typeof window !== "undefined",
    queryFn: async (): Promise<ListSkillsResult> =>
      (await listSkills()) as ListSkillsResult,
    queryKey: skillsListQueryKey,
    staleTime: 0,
  });
}
