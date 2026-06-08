import type { Skill } from "./skills-types";

export type SkillFilter = "all" | "invalid" | "valid";

export function getVisibleSkills(
  skills: Skill[],
  filters: { query: string; validationStatus: SkillFilter }
): Skill[] {
  const query = filters.query.trim().toLowerCase();

  return skills
    .filter((skill) => matchesFilter(skill, filters.validationStatus))
    .filter((skill) => matchesQuery(skill, query))
    .sort(compareSkills);
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

export function getSkillSourceUrlBase(input: {
  repositoryUrl: string;
  skill: Pick<Skill, "indexedCommitSha" | "path">;
}) {
  const sourceUrl = getSkillSourceUrl(input);
  if (!sourceUrl) {
    return "";
  }

  return sourceUrl.split("/").slice(0, -1).join("/");
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

function matchesFilter(skill: Skill, filter: SkillFilter): boolean {
  return filter === "all" || skill.validationStatus === filter;
}

function matchesQuery(skill: Skill, query: string): boolean {
  if (!query) {
    return true;
  }

  return [skill.slug, skill.name ?? "", skill.description ?? "", skill.path]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function compareSkills(a: Skill, b: Skill): number {
  if (a.validationStatus !== b.validationStatus) {
    return a.validationStatus === "invalid" ? -1 : 1;
  }
  return a.slug.localeCompare(b.slug);
}

function encodeRepositoryPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
