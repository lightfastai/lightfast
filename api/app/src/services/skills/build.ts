import type { ReplaceSkillIndexEntryInput } from "@db/app";
import {
  collectSkillIndexCandidates,
  parseSkillFile,
  SKILL_FILE_MAX_BYTES,
  type SkillTreeEntry,
} from "@repo/skills-contract";

import type { BuiltSkillIndex } from "./types";

export function buildSkillIndexEntriesFromTree(input: {
  blobs: Map<string, string>;
  commitSha: string;
  stateId: number;
  tree: SkillTreeEntry[];
}): BuiltSkillIndex {
  void input.stateId;
  const collection = collectSkillIndexCandidates(input.tree);
  const entries: ReplaceSkillIndexEntryInput[] =
    collection.canonicalSkillFiles.map((file) => {
      const slug = file.path.split("/")[1] ?? "";
      const sourceMarkdown =
        file.size > SKILL_FILE_MAX_BYTES
          ? null
          : (input.blobs.get(file.sha) ?? null);
      const parsed = parseSkillFile({
        contentSha: file.sha,
        contentSize: file.size,
        nonStandardResourceCount:
          collection.nonStandardResourceCountBySlug.get(slug) ?? 0,
        path: file.path,
        resources: collection.resourcesBySlug.get(slug),
        sourceMarkdown,
      }).entry;

      return {
        allowedTools: parsed.allowedTools,
        bodyMarkdown: parsed.bodyMarkdown,
        compatibility: parsed.compatibility,
        contentSha: parsed.contentSha,
        contentSize: parsed.contentSize,
        description: parsed.description,
        diagnostics: parsed.diagnostics,
        indexedCommitSha: input.commitSha,
        license: parsed.license,
        metadata: parsed.metadata,
        name: parsed.name,
        nonStandardResourceCount: parsed.nonStandardResourceCount,
        path: parsed.path,
        resources: parsed.resources,
        resourcesTruncated: parsed.resources.truncated ? 1 : 0,
        slug: parsed.slug,
        sourceMarkdown: parsed.sourceMarkdown,
        validationStatus: parsed.validationStatus,
      };
    });

  return {
    entries,
    indexDiagnostics: [
      ...collection.diagnostics,
      ...collection.fatalDiagnostics,
    ],
  };
}
