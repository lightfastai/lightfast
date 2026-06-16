export interface SkillsSearch {
  skill?: string;
}

export interface NormalizedSkillsSearch {
  skill: string | null;
}

function nullableStringSearchParam(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function normalizeSkillsSearch(
  search: Record<string, unknown>
): NormalizedSkillsSearch {
  return {
    skill: nullableStringSearchParam(search.skill),
  };
}

export function validateSkillsSearch(
  search: Record<string, unknown>
): SkillsSearch {
  const normalized = normalizeSkillsSearch(search);
  return {
    ...(normalized.skill ? { skill: normalized.skill } : {}),
  };
}
