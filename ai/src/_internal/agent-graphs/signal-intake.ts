import { defineAgentGraph } from "../../telemetry";

export const signalIntakeAgentGraph = defineAgentGraph({
  id: "signal-intake",
  routerId: "signals",
  version: "v1",
  nodes: {
    signalClassifier: {
      feature: "signals",
      id: "signal-classifier",
      kind: "llm",
      promptId: "signal-classifier",
      role: "router",
      schemaVersion: "signal.classification.v1",
      workflow: "classify-signal",
    },
    peopleClassifier: {
      feature: "people",
      id: "people-classifier",
      kind: "llm",
      promptId: "people-classifier",
      role: "extractor",
      schemaVersion: "people.classification.v1",
      upstreamNodeIds: ["signal-classifier"],
      workflow: "classify-people",
    },
  },
});
