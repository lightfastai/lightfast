import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import {
  triageCandidateRelationSchema,
  triageDecisionSchema,
  triagePrioritySchema,
  triageSimilarityCandidateSchema,
  triageSourceItemSchema,
  triageWorkIntentSchema,
} from "../src/triage/schema";

export const triageGithubIssueEvalInputSchema = z.object({
  sourceItem: triageSourceItemSchema,
  candidates: z.array(triageSimilarityCandidateSchema).max(10),
  availableDestinations: z.array(z.enum(["github", "linear", "lightfast"])),
});

export const triageGithubIssueEvalExpectedSchema = z.object({
  sourceUseful: z.boolean(),
  workIntent: triageWorkIntentSchema,
  priority: triagePrioritySchema,
  triageDecision: triageDecisionSchema,
});

export const triageGithubIssueEvalMetadataSchema = z.object({
  caseId: z.string().trim().min(1),
  source: z.literal("github_issue"),
});

export const triageGithubIssueEvalCaseSchema = z.object({
  input: triageGithubIssueEvalInputSchema,
  expected: triageGithubIssueEvalExpectedSchema,
  metadata: triageGithubIssueEvalMetadataSchema,
});

export type TriageGithubIssueEvalInput = z.infer<
  typeof triageGithubIssueEvalInputSchema
>;
export type TriageGithubIssueEvalExpected = z.infer<
  typeof triageGithubIssueEvalExpectedSchema
>;
export type TriageGithubIssueEvalMetadata = z.infer<
  typeof triageGithubIssueEvalMetadataSchema
>;
export type TriageGithubIssueEvalCase = z.infer<
  typeof triageGithubIssueEvalCaseSchema
>;

export const triageGithubIssueSimilarityEvalExpectedSchema = z.object({
  candidateId: z.string().trim().min(1),
  relation: triageCandidateRelationSchema,
});

export type TriageGithubIssueSimilarityEvalExpected = z.infer<
  typeof triageGithubIssueSimilarityEvalExpectedSchema
>;

export type TriageGithubIssueSimilarityEvalCase = Omit<
  TriageGithubIssueEvalCase,
  "expected"
> & {
  expected: TriageGithubIssueSimilarityEvalExpected;
};

const DATASET_PATH = fileURLToPath(
  new URL("./datasets/triage-github-issues.jsonl", import.meta.url)
);

export function loadTriageGithubIssueEvalCases(): TriageGithubIssueEvalCase[] {
  return readFileSync(DATASET_PATH, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parsedJson = JSON.parse(line) as unknown;
      const parsedCase = triageGithubIssueEvalCaseSchema.safeParse(parsedJson);
      if (!parsedCase.success) {
        throw new Error(
          `Invalid triage GitHub Issue eval fixture at line ${index + 1}: ${parsedCase.error.message}`
        );
      }
      return parsedCase.data;
    });
}

export function loadTriageGithubIssueSimilarityEvalCases(): TriageGithubIssueSimilarityEvalCase[] {
  return loadTriageGithubIssueEvalCases()
    .filter(
      (testCase) =>
        testCase.input.candidates.length > 0 &&
        testCase.expected.triageDecision === "link_existing"
    )
    .map((testCase) => {
      const firstCandidate = testCase.input.candidates[0];

      if (!firstCandidate) {
        throw new Error(
          `Invalid similarity fixture ${testCase.metadata.caseId}: missing candidate`
        );
      }

      return {
        input: testCase.input,
        expected: {
          candidateId: firstCandidate.candidateId,
          relation: "duplicate",
        },
        metadata: testCase.metadata,
      };
    });
}
