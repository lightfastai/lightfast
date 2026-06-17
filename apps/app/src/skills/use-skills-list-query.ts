import { type ListSkillsResult, listSkills } from "@api/app/tanstack/skills";
import { useQuery } from "@tanstack/react-query";

export const skillsListQueryKey = ["skills", "list"] as const;

export function useSkillsListQuery() {
  const options = {
    enabled: typeof window !== "undefined",
    queryFn: async (): Promise<ListSkillsResult> =>
      (await listSkills()) as ListSkillsResult,
    queryKey: skillsListQueryKey,
    staleTime: 0,
  };

  return { query: useQuery(options), queryKey: options.queryKey };
}
