import { Eval, type EvalCase, type EvalScorer } from "braintrust";

import {
  LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT,
  LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PROJECT,
} from "../src/telemetry/braintrust";
import {
  buildTriageSimilarityRequest,
  rankTriageSimilarItems,
} from "../src/triage";
import {
  assertLiveTriageEvalEnvironment,
  isTriageEvalFixtureMode,
} from "./triage-env";
import {
  loadTriageGithubIssueSimilarityEvalCases,
  type TriageGithubIssueEvalInput,
  type TriageGithubIssueEvalMetadata,
  type TriageGithubIssueSimilarityEvalExpected,
} from "./triage-fixtures";

type TriageSimilarityEvalCase = EvalCase<
  TriageGithubIssueEvalInput,
  TriageGithubIssueSimilarityEvalExpected,
  TriageGithubIssueEvalMetadata
>;

type TriageSimilarityEvalOutput = TriageGithubIssueSimilarityEvalExpected;

assertLiveTriageEvalEnvironment(process.env);

const fixtureMode = isTriageEvalFixtureMode(process.env);

function scoreExactField(
  name: string,
  field: keyof TriageGithubIssueSimilarityEvalExpected
): EvalScorer<
  TriageGithubIssueEvalInput,
  TriageSimilarityEvalOutput,
  TriageGithubIssueSimilarityEvalExpected,
  TriageGithubIssueEvalMetadata
> {
  return ({ expected, output }) => ({
    name,
    score: output[field] === expected[field] ? 1 : 0,
    metadata: {
      expected: expected[field],
      output: output[field],
    },
  });
}

async function runLiveSimilarity(
  input: TriageGithubIssueEvalInput,
  metadata: TriageGithubIssueEvalMetadata
): Promise<TriageSimilarityEvalOutput> {
  const triageRunId = `eval_similarity_${metadata.caseId}`;
  const deploymentEnvironment = "development";
  const clerkOrgId = "eval_org_lightfast";

  const similarity = await rankTriageSimilarItems(
    buildTriageSimilarityRequest({
      candidates: input.candidates,
      clerkOrgId,
      deploymentEnvironment,
      sourceItem: input.sourceItem,
      triageRunId,
    })
  );

  const topCandidate = similarity.candidates[0];

  return {
    candidateId: topCandidate?.candidateId ?? "",
    relation: topCandidate?.relation ?? "unrelated",
  };
}

await Eval<
  TriageGithubIssueEvalInput,
  TriageSimilarityEvalOutput,
  TriageGithubIssueSimilarityEvalExpected,
  TriageGithubIssueEvalMetadata
>(
  LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PROJECT,
  {
    data: (): TriageSimilarityEvalCase[] =>
      loadTriageGithubIssueSimilarityEvalCases(),
    task: async (input, hooks) => {
      if (fixtureMode) {
        return hooks.expected;
      }

      return runLiveSimilarity(input, hooks.metadata);
    },
    scores: [
      scoreExactField("candidate_id", "candidateId"),
      scoreExactField("relation", "relation"),
    ],
    metadata: {
      evalName: "triage-github-issue-similarity",
      mode: fixtureMode ? "expected" : "live",
    },
    maxConcurrency: 2,
  },
  {
    noSendLogs: process.env.BRAINTRUST_NO_SEND_LOGS === "1",
    parent: LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT,
    returnResults: true,
  }
);
