export function createSkillRefreshDedupeKey(input: {
  reason: "read" | "schedule" | "setup" | "webhook";
  sourceControlRepositoryId: number;
  targetCommitSha?: string;
}) {
  if (input.targetCommitSha) {
    return `${input.sourceControlRepositoryId}-${input.targetCommitSha}`;
  }

  return `${input.sourceControlRepositoryId}-${input.reason}`;
}
