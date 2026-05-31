import { Eval, type EvalCase, type EvalScorer } from "braintrust";

import {
  LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PARENT,
  LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PROJECT,
} from "../src/telemetry/braintrust";
import {
  buildTriageActionRecommendationRequest,
  buildTriageSimilarityRequest,
  buildTriageSourceItemClassificationRequest,
  classifyTriageSourceItem,
  rankTriageSimilarItems,
  recommendTriageAction,
} from "../src/triage";
import {
  assertLiveTriageEvalEnvironment,
  isTriageEvalFixtureMode,
} from "./triage-env";
import {
  loadTriageGithubIssueEvalCases,
  type TriageGithubIssueEvalExpected,
  type TriageGithubIssueEvalInput,
  type TriageGithubIssueEvalMetadata,
} from "./triage-fixtures";

type TriageGithubIssueEvalCase = EvalCase<
  TriageGithubIssueEvalInput,
  TriageGithubIssueEvalExpected,
  TriageGithubIssueEvalMetadata
>;

type TriageGithubIssueEvalOutput = TriageGithubIssueEvalExpected;

assertLiveTriageEvalEnvironment(process.env);

const fixtureMode = isTriageEvalFixtureMode(process.env);

function scoreExactField(
  name: string,
  field: keyof TriageGithubIssueEvalExpected
): EvalScorer<
  TriageGithubIssueEvalInput,
  TriageGithubIssueEvalOutput,
  TriageGithubIssueEvalExpected,
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

async function runLiveTriage(
  input: TriageGithubIssueEvalInput,
  metadata: TriageGithubIssueEvalMetadata
): Promise<TriageGithubIssueEvalOutput> {
  const triageRunId = `eval_${metadata.caseId}`;
  const deploymentEnvironment = "development";
  const clerkOrgId = "eval_org_lightfast";

  const classification = await classifyTriageSourceItem(
    buildTriageSourceItemClassificationRequest({
      clerkOrgId,
      deploymentEnvironment,
      sourceItem: input.sourceItem,
      triageRunId,
    })
  );

  if (input.candidates.length === 0) {
    return {
      sourceUseful: classification.sourceSignal.isUseful,
      workIntent: classification.workIntent,
      priority: classification.priority,
      triageDecision: classification.triageDecision,
    };
  }

  const similarity = await rankTriageSimilarItems(
    buildTriageSimilarityRequest({
      candidates: input.candidates,
      clerkOrgId,
      deploymentEnvironment,
      sourceItem: input.sourceItem,
      triageRunId,
    })
  );

  const recommendation = await recommendTriageAction(
    buildTriageActionRecommendationRequest({
      availableDestinations: input.availableDestinations,
      classification,
      clerkOrgId,
      deploymentEnvironment,
      similarity,
      sourceItem: input.sourceItem,
      triageRunId,
    })
  );

  return {
    sourceUseful: classification.sourceSignal.isUseful,
    workIntent: classification.workIntent,
    priority: classification.priority,
    triageDecision: recommendation.triageDecision,
  };
}

await Eval<
  TriageGithubIssueEvalInput,
  TriageGithubIssueEvalOutput,
  TriageGithubIssueEvalExpected,
  TriageGithubIssueEvalMetadata
>(
  LIGHTFAST_AGENT_RUNTIME_BRAINTRUST_PROJECT,
  {
    data: (): TriageGithubIssueEvalCase[] => loadTriageGithubIssueEvalCases(),
    task: async (input, hooks) => {
      if (fixtureMode) {
        return hooks.expected;
      }
      return runLiveTriage(input, hooks.metadata);
    },
    scores: [
      scoreExactField("source_useful", "sourceUseful"),
      scoreExactField("work_intent", "workIntent"),
      scoreExactField("priority", "priority"),
      scoreExactField("triage_decision", "triageDecision"),
    ],
    metadata: {
      evalName: "triage-github-issues",
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
