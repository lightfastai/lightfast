import { defineAgentGraph } from "../../telemetry";

export const triageAgentGraph = defineAgentGraph({
  id: "triage",
  routerId: "triage",
  version: "v1",
  nodes: {
    triageSourceClassifier: {
      feature: "triage",
      id: "triage-source-classifier",
      kind: "llm",
      promptId: "triage-source-classifier",
      role: "classifier",
      schemaVersion: "triage.source-item-classification.v1",
      workflow: "triage-source-item",
    },
    triageSimilarityRanker: {
      feature: "triage",
      id: "triage-similarity-ranker",
      kind: "llm",
      promptId: "triage-similarity-ranker",
      role: "router",
      schemaVersion: "triage.similarity-rank.v1",
      upstreamNodeIds: ["triage-source-classifier"],
      workflow: "triage-similarity",
    },
    triageActionRecommender: {
      feature: "triage",
      id: "triage-action-recommender",
      kind: "llm",
      promptId: "triage-action-recommender",
      role: "router",
      schemaVersion: "triage.action-recommendation.v1",
      upstreamNodeIds: ["triage-similarity-ranker"],
      workflow: "triage-action",
    },
  },
});
