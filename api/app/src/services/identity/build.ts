import { createHash } from "node:crypto";
import type { ReplaceIdentityIndexFileInput } from "@db/app";
import {
  IDENTITY_FILE_NAMES,
  IDENTITY_INDEX_MAX_CHARS_PER_FILE,
  type IdentityFileKind,
} from "@repo/identity-contract";

import type { BuiltIdentityIndex, IdentityTreeEntry } from "./types";

const TARGET_FILES: { kind: IdentityFileKind; path: string }[] = [
  { kind: "identity", path: IDENTITY_FILE_NAMES.identity },
  { kind: "soul", path: IDENTITY_FILE_NAMES.soul },
];

export function buildIdentityIndexFilesFromTree(input: {
  blobs: Map<string, string>;
  commitSha: string;
  tree: IdentityTreeEntry[];
}): BuiltIdentityIndex {
  const diagnostics: string[] = [];
  const files = TARGET_FILES.map((target) => {
    const entry = input.tree.find(
      (candidate) => candidate.type === "blob" && candidate.path === target.path
    );

    const file = buildFile({
      blobText: entry ? input.blobs.get(entry.sha) : undefined,
      commitSha: input.commitSha,
      entry,
      kind: target.kind,
      path: target.path,
    });
    diagnostics.push(...(file.diagnostics ?? []));
    return file;
  });

  return {
    files,
    indexDiagnostics: diagnostics,
  };
}

function buildFile(input: {
  blobText: string | undefined;
  commitSha: string;
  entry: IdentityTreeEntry | undefined;
  kind: IdentityFileKind;
  path: string;
}): ReplaceIdentityIndexFileInput {
  if (!input.entry) {
    return {
      contentHash: null,
      contentSha: null,
      contentSize: null,
      diagnostics: [`${input.path} is missing.`],
      indexedCommitSha: input.commitSha,
      kind: input.kind,
      path: input.path,
      sourceMarkdown: null,
      status: "missing",
    };
  }

  if (input.entry.size > IDENTITY_INDEX_MAX_CHARS_PER_FILE) {
    return {
      contentHash: null,
      contentSha: input.entry.sha,
      contentSize: input.entry.size,
      diagnostics: [
        `${input.path} exceeds the ${IDENTITY_INDEX_MAX_CHARS_PER_FILE} character indexing limit.`,
      ],
      indexedCommitSha: input.commitSha,
      kind: input.kind,
      path: input.path,
      sourceMarkdown: null,
      status: "too_large",
    };
  }

  if (input.blobText === undefined) {
    return {
      contentHash: null,
      contentSha: input.entry.sha,
      contentSize: input.entry.size,
      diagnostics: [`${input.path} could not be read.`],
      indexedCommitSha: input.commitSha,
      kind: input.kind,
      path: input.path,
      sourceMarkdown: null,
      status: "read_error",
    };
  }

  if (input.blobText.length > IDENTITY_INDEX_MAX_CHARS_PER_FILE) {
    return {
      contentHash: null,
      contentSha: input.entry.sha,
      contentSize: input.blobText.length,
      diagnostics: [
        `${input.path} exceeds the ${IDENTITY_INDEX_MAX_CHARS_PER_FILE} character indexing limit.`,
      ],
      indexedCommitSha: input.commitSha,
      kind: input.kind,
      path: input.path,
      sourceMarkdown: null,
      status: "too_large",
    };
  }

  return {
    contentHash: `sha256:${createHash("sha256").update(input.blobText).digest("hex")}`,
    contentSha: input.entry.sha,
    contentSize: input.entry.size,
    diagnostics: [],
    indexedCommitSha: input.commitSha,
    kind: input.kind,
    path: input.path,
    sourceMarkdown: input.blobText,
    status: "present",
  };
}
